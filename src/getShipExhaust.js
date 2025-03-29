import * as THREE from "three";

/**
 * 创建飞船尾部喷焰粒子系统
 * @param {Object} options - 配置选项
 * @returns {Object} 包含粒子系统和更新函数的对象
 */
export default function getShipExhaust(options = {}) {
  // 默认配置
  const config = {
    count: 200,           // 减少粒子数量至1/4
    color: 0x00ffff,       // 青色粒子
    size: { min: 0.025, max: 0.05 },  // 缩小粒子尺寸以匹配较小的飞船
    lifetime: { min: 0.5, max: 0.6 },  // 缩短粒子生命周期
    speed: { min: 0.2, max: 0.6 },     // 减小粒子速度
    spread: { x: 0.05, y: 0.05, z: 0.08 }, // 缩小扩散范围，使喷射更集中
    ...options
  };

  // 创建粒子几何体
  const geometry = new THREE.BufferGeometry();
  
  // 创建粒子材质
  const material = new THREE.PointsMaterial({
    color: config.color,
    size: config.size.max,
    transparent: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    depthWrite: false,
    vertexColors: true, // 启用顶点颜色以实现颜色渐变
    opacity: 1.0        // 确保完全不透明
  });

  // 尝试加载粒子贴图，使粒子看起来更柔和
  try {
    const textureLoader = new THREE.TextureLoader();
    const particleTexture = textureLoader.load('./textures/stars/circle.png');
    material.map = particleTexture;
    material.alphaMap = particleTexture; // 同时作为alpha贴图
  } catch (error) {
    console.warn('无法加载粒子贴图:', error);
  }

  // 创建粒子系统，并确保它始终可见（不会被其他物体遮挡）
  const particles = new THREE.Points(geometry, material);
  particles.renderOrder = 999; // 确保粒子在最后渲染
  particles.frustumCulled = false; // 禁用视锥剔除，确保始终渲染
  
  // 粒子属性数组
  const positions = new Float32Array(config.count * 3);
  const velocities = [];
  const sizes = new Float32Array(config.count);
  const colors = new Float32Array(config.count * 3); // 粒子颜色
  const lifetimes = [];
  const maxLifetimes = [];
  const emitterIndices = new Int8Array(config.count); // 记录每个粒子属于哪个发射器
  
  // 发射点位置数组 - 将在setEmitterPositions中设置
  const emitterPositions = [
    new THREE.Vector3(0, 0, 0), // 左发射器
    new THREE.Vector3(0, 0, 0)  // 右发射器
  ];

  // 创建对象池以减少GC压力
  const vectorPool = [];
  for (let i = 0; i < 10; i++) {
    vectorPool.push(new THREE.Vector3());
  }
  let vectorPoolIndex = 0;
  
  // 从对象池获取向量对象
  function getVector() {
    const vec = vectorPool[vectorPoolIndex];
    vectorPoolIndex = (vectorPoolIndex + 1) % vectorPool.length;
    return vec;
  }
  
  // 初始化粒子
  for (let i = 0; i < config.count; i++) {
    // 所有粒子初始位置都在原点(飞船尾部)
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    
    // 初始化粒子颜色为青色
    colors[i * 3] = 0; // R
    colors[i * 3 + 1] = 1; // G
    colors[i * 3 + 2] = 1; // B
    
    // 随机速度
    velocities.push({
      x: (Math.random() - 0.5) * config.spread.x,
      y: (Math.random() - 0.5) * config.spread.y,
      z: Math.random() * config.speed.max + config.speed.min // 向后喷射
    });
    
    // 随机大小
    sizes[i] = Math.random() * (config.size.max - config.size.min) + config.size.min;
    
    // 随机生命周期
    const lifetime = Math.random() * (config.lifetime.max - config.lifetime.min) + config.lifetime.min;
    maxLifetimes.push(lifetime);
    lifetimes.push(0); // 初始生命为0
    
    // 分配粒子到两个发射器
    emitterIndices[i] = i < config.count / 2 ? 0 : 1; // 前一半粒子属于左发射器，后一半属于右发射器
  }
  
  // 设置粒子属性
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  // 活跃粒子计数
  let activeParticles = 0;
  
  // 更新函数
  function update(delta, shipVelocity = 1, isBoost = false, backwardDir = null, rightDir = null, upDir = null) {
    // 性能优化：如果delta过大（可能是页面在后台运行），限制最大增量
    delta = Math.min(delta, 0.1);
    
    const positions = geometry.attributes.position.array;
    
    // 计算本帧应该发射的粒子数量
    const particlesPerEmitter = isBoost 
      ? Math.min(3, Math.ceil(shipVelocity * 1)) // 减少推进时的粒子数量
      : Math.min(1, Math.ceil(shipVelocity * 0.5)); // 减少正常飞行时的粒子数量
    
    // 检查是否提供了飞船方向向量
    const hasShipDirections = backwardDir !== null && rightDir !== null && upDir !== null;
    
    // 更新所有粒子
    let activeCount = 0;
    for (let i = 0; i < config.count; i++) {
      // 确定这个粒子属于哪个发射器
      const emitterIndex = emitterIndices[i];
      const emitterPos = emitterPositions[emitterIndex];
      
      // 如果粒子生命周期结束，重置它
      if (lifetimes[i] >= maxLifetimes[i]) {
        // 只有在需要发射新粒子时才重置
        if (activeParticles < particlesPerEmitter) {
          // 重置位置到对应的发射器位置
          positions[i * 3] = emitterPos.x;
          positions[i * 3 + 1] = emitterPos.y;
          positions[i * 3 + 2] = emitterPos.z;
          
          // 根据飞船速度调整粒子速度
          const speedFactor = Math.max(0.8, shipVelocity);
          
          // 重用现有对象
          const vel = velocities[i];
          
          if (hasShipDirections) {
            // 使用飞船的方向向量计算粒子速度
            // 主要速度沿着后方向量，添加一些随机性在侧向和上下方向
            const randomRight = (Math.random() - 0.5) * config.spread.x;
            const randomUp = (Math.random() - 0.5) * config.spread.y;
            const randomBack = Math.random() * config.speed.max * speedFactor + config.speed.min;
            
            // 将随机偏移应用到飞船的局部坐标系方向
            vel.x = backwardDir.x * randomBack + rightDir.x * randomRight + upDir.x * randomUp;
            vel.y = backwardDir.y * randomBack + rightDir.y * randomRight + upDir.y * randomUp;
            vel.z = backwardDir.z * randomBack + rightDir.z * randomRight + upDir.z * randomUp;
          } else {
            // 回退到默认行为（假设z轴负方向是后方）
            vel.x = (Math.random() - 0.5) * config.spread.x;
            vel.y = (Math.random() - 0.5) * config.spread.y;
            vel.z = Math.random() * config.speed.max * speedFactor + config.speed.min;
          }
          
          // 重置生命周期
          lifetimes[i] = 0;
          maxLifetimes[i] = Math.random() * (config.lifetime.max - config.lifetime.min) + config.lifetime.min;
          
          // 重置粒子颜色为青色
          colors[i * 3] = 0; // R
          colors[i * 3 + 1] = 1; // G
          colors[i * 3 + 2] = 1; // B
          
          // 增加活跃粒子计数
          activeParticles++;
        }
      } else {
        // 更新位置
        positions[i * 3] += velocities[i].x * delta;
        positions[i * 3 + 1] += velocities[i].y * delta;
        positions[i * 3 + 2] += velocities[i].z * delta;
        
        // 更新生命周期
        lifetimes[i] += delta;
        
        // 根据生命周期调整大小（渐变效果）
        const lifeRatio = lifetimes[i] / maxLifetimes[i];
        // 先变大后变小的效果
        let sizeMultiplier = 1.0;
        if (lifeRatio < 0.2) {
          // 开始阶段逐渐变大
          sizeMultiplier = lifeRatio * 5;
        } else {
          // 后期逐渐变小
          sizeMultiplier = 1 - ((lifeRatio - 0.2) * 1.25);
        }
        
        // 应用大小变化
        const size = sizes[i] * Math.max(0, sizeMultiplier);
        geometry.attributes.size.array[i] = size;
        
        // 根据生命周期调整颜色（从青色渐变为暗蓝色）
        if (lifeRatio > 0.5) {
          // 后半段生命周期，开始变暗
          const colorRatio = (lifeRatio - 0.5) * 2; // 0->1
          // 让绿色和蓝色分量随时间减少，产生逐渐变暗和偏蓝的效果
          colors[i * 3] = 0; // R保持为0
          colors[i * 3 + 1] = Math.max(0, 1 - colorRatio * 0.8); // G从1逐渐减少
          colors[i * 3 + 2] = Math.max(0.2, 1 - colorRatio * 0.5); // B从1逐渐减少但保留一些
        }
        
        // 统计活跃粒子
        activeCount++;
      }
    }
    
    // 重置活跃粒子计数
    activeParticles = 0;
    
    // 性能优化：只有当有活跃粒子时才更新几何体属性
    if (activeCount > 0) {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.size.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true; // 更新颜色属性
    }
  }
  
  // 设置粒子系统的整体位置（不影响相对位置）
  function setPosition(position) {
    particles.position.copy(position);
  }
  
  // 设置两个发射器的相对位置
  function setEmitterPositions(leftPos, rightPos) {
    emitterPositions[0].copy(leftPos);
    emitterPositions[1].copy(rightPos);
  }
  
  // 清除所有粒子，用于重置系统或者切换方向时清除旧痕迹
  function clearAllParticles() {
    for (let i = 0; i < config.count; i++) {
      // 将所有粒子生命周期设为最大值，这样下一帧会全部重置
      lifetimes[i] = maxLifetimes[i] + 1;
      
      // 将粒子移动到发射器位置
      const emitterIndex = emitterIndices[i];
      const emitterPos = emitterPositions[emitterIndex];
      
      positions[i * 3] = emitterPos.x;
      positions[i * 3 + 1] = emitterPos.y;
      positions[i * 3 + 2] = emitterPos.z;
    }
    
    // 更新几何体属性
    geometry.attributes.position.needsUpdate = true;
    
    // 重置活跃粒子计数
    activeParticles = 0;
  }
  
  // 立即初始化一批粒子，确保启动时就有效果
  function init(backwardDir, rightDir, upDir) {
    // 立即创建活跃粒子（进一步减少数量）
    const initialParticleCount = Math.min(20, config.count);
    for (let i = 0; i < initialParticleCount; i++) {
      // 确定这个粒子属于哪个发射器
      const emitterIndex = emitterIndices[i];
      const emitterPos = emitterPositions[emitterIndex];
      
      // 随机位置（在对应发射器附近）
      // 检查是否提供了飞船方向向量
      if (backwardDir && rightDir && upDir) {
        // 使用飞船的方向向量计算偏移
        const randomRight = (Math.random() - 0.5) * 0.1;
        const randomUp = (Math.random() - 0.5) * 0.1;
        const randomBack = (Math.random() - 0.5) * 0.8 - 0.1; // 向后分布
        
        // 设置基本位置为发射器位置
        positions[i * 3] = emitterPos.x;
        positions[i * 3 + 1] = emitterPos.y;
        positions[i * 3 + 2] = emitterPos.z;
        
        // 在局部坐标系中添加偏移
        positions[i * 3] += rightDir.x * randomRight + upDir.x * randomUp + backwardDir.x * randomBack;
        positions[i * 3 + 1] += rightDir.y * randomRight + upDir.y * randomUp + backwardDir.y * randomBack;
        positions[i * 3 + 2] += rightDir.z * randomRight + upDir.z * randomUp + backwardDir.z * randomBack;
        
        // 随机速度（基于飞船方向）
        const velRandomRight = (Math.random() - 0.5) * config.spread.x * 1.5;
        const velRandomUp = (Math.random() - 0.5) * config.spread.y * 1.5;
        const velRandomBack = Math.random() * config.speed.max * 2 + config.speed.min;
        
        // 应用速度到飞船局部坐标系
        velocities[i].x = backwardDir.x * velRandomBack + rightDir.x * velRandomRight + upDir.x * velRandomUp;
        velocities[i].y = backwardDir.y * velRandomBack + rightDir.y * velRandomRight + upDir.y * velRandomUp;
        velocities[i].z = backwardDir.z * velRandomBack + rightDir.z * velRandomRight + upDir.z * velRandomUp;
      } else {
        // 回退到默认行为
        positions[i * 3] = emitterPos.x + (Math.random() - 0.5) * 0.1;
        positions[i * 3 + 1] = emitterPos.y + (Math.random() - 0.5) * 0.1;
        positions[i * 3 + 2] = emitterPos.z + (Math.random() - 0.5) * 0.8 - 0.1; // 向后分布
        
        // 随机速度
        velocities[i].x = (Math.random() - 0.5) * config.spread.x * 1.5;
        velocities[i].y = (Math.random() - 0.5) * config.spread.y * 1.5;
        velocities[i].z = Math.random() * config.speed.max * 2 + config.speed.min;
      }
      
      // 随机生命周期，使其不会同时消失
      lifetimes[i] = Math.random() * maxLifetimes[i] * 0.7;
      
      // 设置颜色为明亮的青色
      colors[i * 3] = 0; // R
      colors[i * 3 + 1] = 1; // G
      colors[i * 3 + 2] = 1; // B
    }
    
    // 更新几何体属性
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }
  
  // 返回粒子系统和更新函数
  return {
    particles,
    update,
    setPosition,
    setEmitterPositions,
    clearAllParticles,
    init
  };
}