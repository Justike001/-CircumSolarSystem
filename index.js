import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'jsm/loaders/GLTFLoader.js';

import getStarfield from "./src/getStarfield.js";
import { getFresnelMat } from "./src/getFresnelMat.js";
import getShipExhaust from "./src/getShipExhaust.js";
import createSolarSystem from "./src/createSolarSystem.js";

// 定义太阳系常量，与createSolarSystem.js中保持一致
const EARTH_RADIUS = 10; // 地球半径作为基准
const JUPITER_RADIUS_RATIO = 11.2;
const SATURN_RADIUS_RATIO = 9.45;

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 10000); // 增加相机远裁剪面，适应更大的场景
camera.position.z = 500; // 增加初始相机距离，以便能看到更大的太阳和更分散的行星
// 相机相对于飞船的偏移量
const cameraOffset = new THREE.Vector3(0, 1, 2); // 减小相机距离，使其更靠近飞船
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);
// THREE.ColorManagement.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

// 创建太阳系
const planets = createSolarSystem();
scene.add(planets.solarSystem);

// 为木星和土星添加专门的点光源
const jupiterLight = new THREE.PointLight(0xffffee, 150, 0, 1); // 强度降低为原来的1/100
scene.add(jupiterLight);

const saturnLight = new THREE.PointLight(0xffffee, 120, 0, 1); // 强度降低为原来的1/100
scene.add(saturnLight);

// 为木星和土星添加聚光灯，模拟太阳光照射，调整为大范围照射
const jupiterSpotlight = new THREE.SpotLight(0xffffee, 20, 0, Math.PI*0.75, 3, 2); // 角度扩大到135度
scene.add(jupiterSpotlight);

const saturnSpotlight = new THREE.SpotLight(0xffffee, 16, 0, Math.PI*0.75, 3, 2); // 角度扩大到135度
scene.add(saturnSpotlight);

// 提取所需的行星引用，以便在动画循环中使用
const { 
  solarSystem, sunMesh, sunCoreMesh, sunGlowMesh, sunShaderMaterial, solarFlareRingMaterial,
  sunAtmosphereMaterial, sunEruptionSystem,
  mercurySystem, mercuryMesh,
  venusSystem, venusMesh,
  earthSystem, earthMesh, lightsMesh, cloudsMesh, earthGlowMesh,
  moonSystem, moonMesh,
  marsSystem, marsMesh,
  jupiterSystem, jupiterMesh,
  saturnSystem, saturnMesh, saturnRingMesh,
  uranusSystem, uranusMesh, uranusRingMesh,
  neptuneSystem, neptuneMesh,
  plutoSystem, plutoMesh
} = planets;

// 获取moonGlowMesh引用
const moonGlowMesh = moonSystem.children.find(child => child.material && child.material.type === 'ShaderMaterial');

// 创建并添加星空，确保它在场景最前面
const stars = getStarfield({numStars: 10000}); // 减少星星数量到原来的1/3(从15000减到5000)
scene.add(stars);
console.log("星空对象已添加:", stars);

// 添加环境光，使场景不会太暗
const ambientLight = new THREE.AmbientLight(0x404040, 2.0); // 增加环境光强度，从0.5到2.0
scene.add(ambientLight);

// 加载Gladiator模型
const gladiatorGroup = new THREE.Group();
scene.add(gladiatorGroup);

// 为飞船添加专门的聚光灯
const shipSpotlight = new THREE.SpotLight(0xffffff, 100, 20, Math.PI / 4, 0.5, 2);
shipSpotlight.position.set(0, 2.5, 0); // 缩小上方距离，以匹配较小的飞船
shipSpotlight.target = gladiatorGroup; // 聚光灯始终指向飞船
shipSpotlight.castShadow = true;
scene.add(shipSpotlight);

// 飞船移动控制变量
const shipControls = {
  pitchUp: false,    // W键 - 抬起飞行方向
  pitchDown: false,  // S键 - 下压飞行方向
  bankLeft: false,   // A键 - 向左偏移并倾斜
  bankRight: false,  // D键 - 向右偏移并倾斜
  boost: false,      // Shift键 - 加速
  stop: false,       // Space键 - 停止飞行
  baseSpeed: 0.4,    // 基础速度（降低为原来的1/5：2.0→0.4）
  boostSpeed: 1.2,   // 加速时的速度（也降低为原来的1/5：6.0→1.2）
  speed: 0.4,        // 当前速度
  maxBankAngle: Math.PI / 6 // 最大倾斜角度（30度）
};

// 创建飞船尾部喷焰粒子系统
const shipExhaust = getShipExhaust({
  count: 100,            // 减少到原来的1/4
  color: 0x00ffff,        // 青色粒子
  size: { min: 0.025, max: 0.05 }, // 缩小粒子尺寸以匹配较小的飞船
  lifetime: { min: 0.5, max: 0.6 }, // 设置粒子生命周期
  speed: { min: 0.2, max: 0.6 },    // 减小粒子速度，以匹配较小的飞船
  spread: { x: 0.05, y: 0.05, z: 0.08 } // 调整扩散范围，使喷射更集中
});

// 将粒子系统添加到场景中
scene.add(shipExhaust.particles);

// 设置模型加载器
const gltfLoader = new GLTFLoader();
gltfLoader.load('./model/source/Gladiator.glb', (gltf) => {
  const model = gltf.scene;
  
  // 加载模型贴图
  const textureLoader = new THREE.TextureLoader();
  const gladiatorTexture = textureLoader.load('./model/textures/Texture.png');
  const gladiatorEmission = textureLoader.load('./model/textures/Emission.png');
  const gladiatorMetalness = textureLoader.load('./model/textures/Metalness.png');
  const gladiatorRoughness = textureLoader.load('./model/textures/Roughness.png');
  
  // 遍历模型中的所有网格，应用材质
  model.traverse((node) => {
    if (node.isMesh) {
      // 创建PBR材质，优化以更好地反射太阳光
      const material = new THREE.MeshStandardMaterial({
        map: gladiatorTexture,
        emissiveMap: gladiatorEmission,
        emissive: 0xffffff,
        emissiveIntensity: 0.5, // 降低自发光强度，让反射光更明显
        metalnessMap: gladiatorMetalness,
        metalness: 0.8, // 调整金属度以更好地反射光线
        roughnessMap: gladiatorRoughness,
        roughness: 0.2, // 降低粗糙度以增加反射效果
        envMapIntensity: 1.5 // 增强环境反射强度
      });
      
      // 设置接收阴影
      node.castShadow = true;
      node.receiveShadow = true;
      
      node.material = material;
    }
  });
  
  // 调整模型大小和朝向 - 缩小至原来的1/4
  model.scale.set(0.0125, 0.0125, 0.0125); // 从0.05缩小到0.0125
  model.rotation.y = Math.PI;
  
  // 将模型添加到Gladiator组
  gladiatorGroup.add(model);
  
  // 设置Gladiator的初始位置（靠近地球）
  gladiatorGroup.position.copy(earthSystem.position);
  gladiatorGroup.position.y += 20;
  gladiatorGroup.position.z += 60; // 增加一点距离
  
  // 获取飞船的世界位置
  const shipPosition = new THREE.Vector3();
  gladiatorGroup.getWorldPosition(shipPosition);
  
  // 获取飞船的方向向量（z轴负方向为前）
  const shipDirection = new THREE.Vector3();
  gladiatorGroup.getWorldDirection(shipDirection);
  shipDirection.negate(); // 因为模型可能面向z轴正方向，所以需要取反
  
  // 计算喷焰位置的方向向量
  const exhaustWorldUp = new THREE.Vector3(0, 1, 0);
  const exhaustRightDir = new THREE.Vector3();
  exhaustRightDir.crossVectors(shipDirection, exhaustWorldUp).normalize();
  const exhaustUpDir = new THREE.Vector3();
  exhaustUpDir.crossVectors(exhaustRightDir, shipDirection).normalize();
  
  // 创建两个固定的尾部发射点
  const exhaustOffset = 0.001;   // 进一步减小后方偏移距离，更贴近飞船尾部
  const sideOffset = 0.001;     // 进一步减小左右偏移距离
  const verticalOffset = -0.001; // 进一步减小垂直偏移量
  
  // 左侧发射器位置
  const leftEmitterPos = new THREE.Vector3()
    .addScaledVector(shipDirection, -exhaustOffset)
    .addScaledVector(exhaustRightDir, sideOffset)
    .addScaledVector(exhaustUpDir, verticalOffset);
  
  // 右侧发射器位置
  const rightEmitterPos = new THREE.Vector3()
    .addScaledVector(shipDirection, -exhaustOffset)
    .addScaledVector(exhaustRightDir, -sideOffset)
    .addScaledVector(exhaustUpDir, verticalOffset);
  
  // 设置粒子系统整体位置为飞船位置
  shipExhaust.setPosition(shipPosition);
  
  // 设置两个发射点的相对位置
  shipExhaust.setEmitterPositions(leftEmitterPos, rightEmitterPos);
  
  // 计算飞船的向后方向 - 用于指导粒子的运动方向
  const exhaustBackwardDir = shipDirection.clone().negate(); // 向后方向
  
  // 初始化粒子系统（如果尚未初始化）
  if (!shipExhaust.particles.userData.initialized) {
    shipExhaust.init(exhaustBackwardDir, exhaustRightDir, exhaustUpDir);
    shipExhaust.particles.userData.initialized = true;
    console.log("粒子系统已初始化");
  }
  
  // 不在这里调用update，让tickParticles函数处理更新
  // shipExhaust.update(1/60, 1.0, true, exhaustBackwardDir, exhaustRightDir, exhaustUpDir);
}, undefined, (error) => {
  console.error('加载模型时出错:', error);
});

// 记录上一帧的时间戳，用于计算帧间隔
let lastTime = 0;

// 确保粒子系统持续运行，即使在静止状态
function tickParticles() {
  // 每帧强制更新粒子系统
  if (shipExhaust && shipExhaust.particles) {
    // 如果按下Space键停止，则隐藏粒子系统
    if (shipControls.stop) {
      shipExhaust.particles.visible = false;
      requestAnimationFrame(tickParticles);
      return;
    }
    
    // 否则确保粒子系统可见
    shipExhaust.particles.visible = true;
    
    // 如果船体还未加载完成，先不更新粒子系统
    if (!gladiatorGroup.children.length) {
      requestAnimationFrame(tickParticles);
      return;
    }
    
    // 获取飞船的世界位置和方向
    const shipPosition = new THREE.Vector3();
    gladiatorGroup.getWorldPosition(shipPosition);
    
    // 获取飞船的方向向量（z轴负方向为前）
    const shipDirection = new THREE.Vector3();
    gladiatorGroup.getWorldDirection(shipDirection);
    shipDirection.negate(); // 因为模型可能面向z轴正方向，所以需要取反
    
    // 计算喷焰位置的方向向量
    const exhaustWorldUp = new THREE.Vector3(0, 1, 0);
    const exhaustRightDir = new THREE.Vector3();
    exhaustRightDir.crossVectors(shipDirection, exhaustWorldUp).normalize();
    const exhaustUpDir = new THREE.Vector3();
    exhaustUpDir.crossVectors(exhaustRightDir, shipDirection).normalize();
    
    // 创建两个固定的尾部发射点
    const exhaustOffset = 0.001;   // 进一步减小后方偏移距离，更贴近飞船尾部
    const sideOffset = 0.001;     // 进一步减小左右偏移距离
    const verticalOffset = -0.001; // 进一步减小垂直偏移量
    
    // 左侧发射器位置
    const leftEmitterPos = new THREE.Vector3()
      .addScaledVector(shipDirection, -exhaustOffset)
      .addScaledVector(exhaustRightDir, sideOffset)
      .addScaledVector(exhaustUpDir, verticalOffset);
    
    // 右侧发射器位置
    const rightEmitterPos = new THREE.Vector3()
      .addScaledVector(shipDirection, -exhaustOffset)
      .addScaledVector(exhaustRightDir, -sideOffset)
      .addScaledVector(exhaustUpDir, verticalOffset);
    
    // 设置粒子系统整体位置为飞船位置
    shipExhaust.setPosition(shipPosition);
    
    // 设置两个发射点的相对位置
    shipExhaust.setEmitterPositions(leftEmitterPos, rightEmitterPos);
    
    // 计算飞船的向后方向 - 用于指导粒子的运动方向
    const exhaustBackwardDir = shipDirection.clone().negate(); // 向后方向
    
    // 检测飞船方向变化
    if (shipExhaust.particles.userData.lastDirection) {
      const lastDir = shipExhaust.particles.userData.lastDirection;
      // 计算方向变化的角度
      const angle = exhaustBackwardDir.angleTo(lastDir);
      
      // 如果方向变化超过一定角度（10度），或加速状态改变，清除所有粒子
      if (angle > 0.174 || // 约10度
          shipExhaust.particles.userData.lastBoostState !== shipControls.boost) {
        
        // 清除所有粒子，防止静态粒子痕迹
        if (shipExhaust.clearAllParticles) {
          shipExhaust.clearAllParticles();
        }
      }
    }
    
    // 存储当前方向和加速状态，用于下一帧检测变化
    shipExhaust.particles.userData.lastDirection = exhaustBackwardDir.clone();
    shipExhaust.particles.userData.lastBoostState = shipControls.boost;
    
    // 初始化粒子系统（如果尚未初始化）
    if (!shipExhaust.particles.userData.initialized) {
      shipExhaust.init(exhaustBackwardDir, exhaustRightDir, exhaustUpDir);
      shipExhaust.particles.userData.initialized = true;
      console.log("粒子系统已初始化");
    }
    
    // 确定当前飞船状态 - 正常飞行或加速
    const isBoost = shipControls.boost;
    const currentShipSpeed = shipControls.speed;
    
    // 更新粒子系统，传入当前的飞船速度，而不是固定值
    shipExhaust.update(1/60, currentShipSpeed, isBoost, exhaustBackwardDir, exhaustRightDir, exhaustUpDir);
  }
  
  // 持续调用
  requestAnimationFrame(tickParticles);
}

// 立即启动粒子系统持续更新
tickParticles();

// 更新木星和土星的光源位置，使其始终位于太阳方向
function updateGasGiantLights() {
  // 获取木星和土星的位置
  const jupiterPosition = new THREE.Vector3();
  jupiterSystem.getWorldPosition(jupiterPosition);
  
  const saturnPosition = new THREE.Vector3();
  saturnSystem.getWorldPosition(saturnPosition);
  
  // 计算从行星到太阳的方向向量
  const toSun = new THREE.Vector3(0, 0, 0).sub(jupiterPosition).normalize();
  
  // 将光源放在行星附近，刚好位于行星表面
  jupiterLight.position.copy(jupiterPosition).addScaledVector(toSun, EARTH_RADIUS * JUPITER_RADIUS_RATIO * 1.1);
  
  // 对土星也做同样处理
  const saturnToSun = new THREE.Vector3(0, 0, 0).sub(saturnPosition).normalize();
  saturnLight.position.copy(saturnPosition).addScaledVector(saturnToSun, EARTH_RADIUS * SATURN_RADIUS_RATIO * 1.1);
  
  // 更新聚光灯位置和目标
  // 将聚光灯放在太阳方向，但距离增加到3000，确保足够远
  jupiterSpotlight.position.copy(jupiterPosition).addScaledVector(toSun, -3000);
  jupiterSpotlight.target = jupiterMesh;
  jupiterSpotlight.lookAt(jupiterPosition);
  
  saturnSpotlight.position.copy(saturnPosition).addScaledVector(saturnToSun, -3000);
  saturnSpotlight.target = saturnMesh;
  saturnSpotlight.lookAt(saturnPosition);
}

function animate(timestamp = 0) {
  requestAnimationFrame(animate);
  
  // 计算帧间隔时间（秒）
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // 更新木星和土星的光源位置
  updateGasGiantLights();

  // 额外处理：确保木星和土星的材质有自发光属性
  if (jupiterMesh && jupiterMesh.material) {
    if (!jupiterMesh.material.emissive) {
      jupiterMesh.material.emissive = new THREE.Color(0x553311);
      jupiterMesh.material.emissiveIntensity = 0.3;
      jupiterMesh.material.needsUpdate = true;
    }
  }
  
  if (saturnMesh && saturnMesh.material) {
    if (!saturnMesh.material.emissive) {
      saturnMesh.material.emissive = new THREE.Color(0x554422);
      saturnMesh.material.emissiveIntensity = 0.3;
      saturnMesh.material.needsUpdate = true;
    }
  }

  // 更新太阳着色器的时间参数
  if (sunShaderMaterial) {
    sunShaderMaterial.uniforms.time.value += delta;
  }

  // 更新太阳耀斑环的时间参数
  if (solarFlareRingMaterial) {
    solarFlareRingMaterial.uniforms.time.value += delta;
  }

  // 更新太阳大气光晕的时间参数
  if (sunAtmosphereMaterial) {
    sunAtmosphereMaterial.uniforms.time.value += delta;
  }

  // 更新太阳喷发粒子系统
  if (sunEruptionSystem && sunEruptionSystem.update) {
    sunEruptionSystem.update(delta);
  }

  // 行星自转与公转动画
  
  // 基础单位 - 与createSolarSystem.js中保持一致
  const AU_SCALE = 400; // 天文单位的缩放比例，从250增加到400
  
  // 各行星距离太阳的天文单位值
  const MERCURY_AU = 0.39;
  const VENUS_AU = 0.72;
  const EARTH_AU = 1.0;
  const MARS_AU = 1.52;
  const JUPITER_AU = 5.2;
  const SATURN_AU = 9.54;
  const URANUS_AU = 19.2;
  const NEPTUNE_AU = 30.06;
  const PLUTO_AU = 39.5;
  
  // 水星 - 自转慢，公转快
  mercuryMesh.rotation.y += 0.001;
  const mercuryOrbitAngle = Date.now() * 0.0002;
  mercurySystem.position.x = Math.cos(mercuryOrbitAngle) * AU_SCALE * MERCURY_AU * 5 / 15; // 从扩大5倍改为原来的1/3
  mercurySystem.position.z = Math.sin(mercuryOrbitAngle) * AU_SCALE * MERCURY_AU * 5 / 15; // 从扩大5倍改为原来的1/3
  
  // 金星 - 自转反向且非常慢，公转适中
  venusMesh.rotation.y -= 0.0005;
  const venusOrbitAngle = Date.now() * 0.00015;
  venusSystem.position.x = Math.cos(venusOrbitAngle) * AU_SCALE * VENUS_AU;
  venusSystem.position.z = Math.sin(venusOrbitAngle) * AU_SCALE * VENUS_AU;
  
  // 地球系统
  earthMesh.rotation.y += 0.002;
  lightsMesh.rotation.y += 0.002;
  cloudsMesh.rotation.y += 0.0023;
  earthGlowMesh.rotation.y += 0.002;
  
  // 地球公转
  const earthOrbitAngle = Date.now() * 0.0001;
  earthSystem.position.x = Math.cos(earthOrbitAngle) * AU_SCALE * EARTH_AU;
  earthSystem.position.z = Math.sin(earthOrbitAngle) * AU_SCALE * EARTH_AU;
  
  // 月球 - 月球围绕地球的距离为地球半径的2.5倍
  moonMesh.rotation.y += 0.001;
  moonGlowMesh.rotation.y += 0.001;
  const moonOrbitAngle = Date.now() * 0.0005;
  const EARTH_RADIUS = 10;
  moonSystem.position.x = Math.cos(moonOrbitAngle) * EARTH_RADIUS * 2.5;
  moonSystem.position.z = Math.sin(moonOrbitAngle) * EARTH_RADIUS * 2.5;
  
  // 火星
  marsMesh.rotation.y += 0.0019;
  const marsOrbitAngle = Date.now() * 0.00008;
  marsSystem.position.x = Math.cos(marsOrbitAngle) * AU_SCALE * MARS_AU;
  marsSystem.position.z = Math.sin(marsOrbitAngle) * AU_SCALE * MARS_AU;
  
  // 木星 - 自转很快，公转慢
  jupiterMesh.rotation.y += 0.005;
  const jupiterOrbitAngle = Date.now() * 0.00004;
  jupiterSystem.position.x = Math.cos(jupiterOrbitAngle) * AU_SCALE * JUPITER_AU;
  jupiterSystem.position.z = Math.sin(jupiterOrbitAngle) * AU_SCALE * JUPITER_AU;
  
  // 土星 - 自转快，公转更慢
  saturnMesh.rotation.y += 0.0045;
  saturnRingMesh.rotation.z += 0.0002; // 环也稍微旋转
  const saturnOrbitAngle = Date.now() * 0.00003;
  saturnSystem.position.x = Math.cos(saturnOrbitAngle) * AU_SCALE * SATURN_AU;
  saturnSystem.position.z = Math.sin(saturnOrbitAngle) * AU_SCALE * SATURN_AU;
  
  // 天王星 - 特殊的自转（横向）
  uranusMesh.rotation.z += 0.003;
  uranusRingMesh.rotation.z += 0.0005; // 环也稍微旋转
  const uranusOrbitAngle = Date.now() * 0.00002;
  uranusSystem.position.x = Math.cos(uranusOrbitAngle) * AU_SCALE * URANUS_AU;
  uranusSystem.position.z = Math.sin(uranusOrbitAngle) * AU_SCALE * URANUS_AU;
  
  // 海王星
  neptuneMesh.rotation.y += 0.004;
  const neptuneOrbitAngle = Date.now() * 0.000015;
  neptuneSystem.position.x = Math.cos(neptuneOrbitAngle) * AU_SCALE * NEPTUNE_AU;
  neptuneSystem.position.z = Math.sin(neptuneOrbitAngle) * AU_SCALE * NEPTUNE_AU;
  
  // 冥王星
  plutoMesh.rotation.y += 0.001;
  const plutoOrbitAngle = Date.now() * 0.00001;
  plutoSystem.position.x = Math.cos(plutoOrbitAngle) * AU_SCALE * PLUTO_AU;
  plutoSystem.position.z = Math.sin(plutoOrbitAngle) * AU_SCALE * PLUTO_AU;
  
  // 太阳自转
  sunMesh.rotation.y += 0.0005;
  sunCoreMesh.rotation.y += 0.0005; // 内核层与主太阳同步旋转
  sunGlowMesh.rotation.y += 0.0003;
  
  // Gladiator飞船控制
  if (gladiatorGroup) {
    // 让Gladiator模型在太空中漂浮（放大10倍）
    const floatAngle = Date.now() * 0.001;
    // 保留一点点漂浮效果，但减小幅度
    const floatAmount = shipControls.pitchUp || shipControls.pitchDown ? 0 : 2;
    gladiatorGroup.position.y = Math.sin(floatAngle) * floatAmount;
    
    // 更新聚光灯位置，使其跟随飞船
    if (shipSpotlight) {
      // 获取飞船的世界位置
      const shipPosition = new THREE.Vector3();
      gladiatorGroup.getWorldPosition(shipPosition);
      
      // 设置聚光灯位置在飞船上方
      shipSpotlight.position.set(
        shipPosition.x,
        shipPosition.y + 2.5,
        shipPosition.z
      );
    }
    
    // 根据键盘输入控制飞船移动
    // 创建一个表示飞船前进方向的向量
    const direction = new THREE.Vector3();
    // 设置飞船的朝向（z轴负方向为前）
    gladiatorGroup.getWorldDirection(direction);
    direction.negate(); // 因为模型可能面向z轴正方向，所以需要取反
    
    // 计算左右方向（叉乘得到垂直于前进方向和上方向的向量）
    const rightDirection = new THREE.Vector3();
    rightDirection.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    
    // 计算上方向（叉乘得到垂直于前进方向和右方向的向量）
    const upDirection = new THREE.Vector3();
    upDirection.crossVectors(rightDirection, direction).normalize();
    
    // 保存当前旋转四元数，用于平滑过渡
    const currentRotation = new THREE.Quaternion();
    gladiatorGroup.getWorldQuaternion(currentRotation);
    
    // 创建目标旋转四元数
    let targetRotation = new THREE.Quaternion().copy(currentRotation);
    let needRotationUpdate = false;
    
    // 默认自动前进，除非按下Space键停止
    if (!shipControls.stop) {
      gladiatorGroup.position.addScaledVector(direction, shipControls.speed);
    }
    
    // 应用俯仰控制 (W/S键)
    if (shipControls.pitchUp && !shipControls.stop) {
      // 向上俯仰 - 抬起飞行方向
      const pitchUpRotation = new THREE.Quaternion().setFromAxisAngle(rightDirection, 0.02);
      targetRotation.premultiply(pitchUpRotation);
      needRotationUpdate = true;
    }
    if (shipControls.pitchDown && !shipControls.stop) {
      // 向下俯仰 - 下压飞行方向
      const pitchDownRotation = new THREE.Quaternion().setFromAxisAngle(rightDirection, -0.02);
      targetRotation.premultiply(pitchDownRotation);
      needRotationUpdate = true;
    }
    
    // 应用左右偏移和倾斜控制 (A/D键)
    if (shipControls.bankLeft && !shipControls.stop) {
      // 向左偏移
      gladiatorGroup.position.addScaledVector(rightDirection, shipControls.speed * 0.05);
      
      // 逆时针旋转飞船（绕z轴）
      // 限制倾斜角度不超过30度
      const bankAngle = Math.min(0.05, shipControls.maxBankAngle);
      const bankLeftRotation = new THREE.Quaternion().setFromAxisAngle(direction, -bankAngle);
      targetRotation.premultiply(bankLeftRotation);
      
      // 同时轻微左转
      const turnLeftRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.2);
      targetRotation.premultiply(turnLeftRotation);
      
      needRotationUpdate = true;
    }
    if (shipControls.bankRight && !shipControls.stop) {
      // 向右偏移
      gladiatorGroup.position.addScaledVector(rightDirection, shipControls.speed * -0.05);
      
      // 顺时针旋转飞船（绕z轴）
      // 限制倾斜角度不超过30度
      const bankAngle = Math.min(0.05, shipControls.maxBankAngle);
      const bankRightRotation = new THREE.Quaternion().setFromAxisAngle(direction, bankAngle);
      targetRotation.premultiply(bankRightRotation);
      
      // 同时轻微右转
      const turnRightRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.2);
      targetRotation.premultiply(turnRightRotation);
      
      needRotationUpdate = true;
    }
    
    // 平滑应用旋转
    if (needRotationUpdate) {
      // 使用球面线性插值(slerp)实现平滑旋转
      gladiatorGroup.quaternion.slerp(targetRotation, 0.1);
    } else {
      // 如果没有输入，只恢复左右倾斜角度，不恢复偏移量
      // 获取当前飞船的旋转信息
      const currentRotation = new THREE.Quaternion();
      gladiatorGroup.getWorldQuaternion(currentRotation);
      
      // 创建一个只恢复倾斜角度的目标旋转
      const levelRotation = new THREE.Quaternion();
      
      // 获取当前飞船的朝向
      const currentDirection = new THREE.Vector3();
      gladiatorGroup.getWorldDirection(currentDirection);
      currentDirection.negate(); // 因为模型可能面向z轴正方向，所以需要取反
      
      // 计算当前的上方向（保持当前的航向，只修正倾斜）
      const worldUp = new THREE.Vector3(0, 1, 0);
      const rightDir = new THREE.Vector3();
      rightDir.crossVectors(currentDirection, worldUp).normalize();
      const correctedUp = new THREE.Vector3();
      correctedUp.crossVectors(rightDir, currentDirection).normalize();
      
      // 创建一个矩阵，保持当前航向但修正倾斜
      const targetMatrix = new THREE.Matrix4().lookAt(
        new THREE.Vector3(),
        currentDirection,
        worldUp
      );
      levelRotation.setFromRotationMatrix(targetMatrix);
      
      // 加快机身回正速度（从0.005增加到0.02），但只恢复倾斜角度
      gladiatorGroup.quaternion.slerp(levelRotation, 0.02);
    }
    
    // 更新相机位置，使其跟随飞船
    const relativeCameraOffset = new THREE.Vector3().copy(cameraOffset);
    const targetCameraPosition = relativeCameraOffset.applyMatrix4(gladiatorGroup.matrixWorld);
    
    // 根据是否加速决定相机跟随方式
    if (shipControls.boost) {
      // 加速时使用插值实现平滑过渡，增强速度感
      camera.position.lerp(targetCameraPosition, 0.05);
    } else {
      // 普通状态下直接跟随，无需插值
      camera.position.copy(targetCameraPosition);
    }
    
    // 相机始终看向飞船
    camera.lookAt(gladiatorGroup.position);
  }

  renderer.render(scene, camera);
}

// 处理键盘按下事件
function handleKeyDown(event) {
  switch (event.code) {
    case 'KeyW':
      shipControls.pitchUp = true;
      break;
    case 'KeyS':
      shipControls.pitchDown = true;
      break;
    case 'KeyA':
      shipControls.bankLeft = true;
      break;
    case 'KeyD':
      shipControls.bankRight = true;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      shipControls.boost = true;
      shipControls.speed = shipControls.boostSpeed;
      break;
    case 'Space':
      shipControls.stop = true;
      // 停止飞行时清除所有粒子
      if (shipExhaust && shipExhaust.clearAllParticles) {
        shipExhaust.clearAllParticles();
      }
      break;
  }
}

// 处理键盘释放事件
function handleKeyUp(event) {
  switch (event.code) {
    case 'KeyW':
      shipControls.pitchUp = false;
      break;
    case 'KeyS':
      shipControls.pitchDown = false;
      break;
    case 'KeyA':
      shipControls.bankLeft = false;
      break;
    case 'KeyD':
      shipControls.bankRight = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      shipControls.boost = false;
      shipControls.speed = shipControls.baseSpeed;
      break;
    case 'Space':
      shipControls.stop = false;
      // 恢复飞行时清除所有粒子，防止出现静态粒子痕迹
      if (shipExhaust && shipExhaust.clearAllParticles) {
        shipExhaust.clearAllParticles();
      }
      break;
  }
}

// 注册键盘事件监听器
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

// 窗口大小变化时调整渲染器尺寸
window.addEventListener('resize', function() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// 启动渲染循环
animate();

// 在页面左上角添加说明框
function createInstructionPanel() {
  const panel = document.createElement('div');
  panel.style.position = 'absolute';
  panel.style.top = '20px';
  panel.style.left = '20px';
  panel.style.width = '300px';
  panel.style.padding = '15px';
  panel.style.backgroundColor = 'rgba(0, 50, 100, 0.6)'; // 半透明蓝色
  panel.style.borderRadius = '10px';
  panel.style.boxShadow = '0 0 10px rgba(0, 100, 200, 0.5)';
  panel.style.color = 'white';
  panel.style.fontFamily = 'Arial, sans-serif';
  panel.style.zIndex = '1000';
  
  // 添加标题
  const title = document.createElement('h2');
  title.textContent = '欢迎搭乘Justike的宇宙飞船';
  title.style.textAlign = 'center';
  title.style.margin = '0 0 10px 0';
  title.style.fontSize = '18px';
  title.style.color = '#0cf'; // 青蓝色字体
  panel.appendChild(title);
  
  // 添加操作说明
  const controlsText = document.createElement('p');
  controlsText.textContent = '尝试用WASD键操控飞船运行';
  controlsText.style.textAlign = 'center';
  controlsText.style.margin = '5px 0';
  controlsText.style.fontSize = '16px';
  panel.appendChild(controlsText);
  
  // 添加速度说明
  const boostText = document.createElement('p');
  boostText.textContent = '按Shift键加速';
  boostText.style.textAlign = 'center';
  boostText.style.margin = '5px 0';
  boostText.style.fontSize = '16px';
  panel.appendChild(boostText);
  
  // 添加停止飞行说明
  const stopText = document.createElement('p');
  stopText.textContent = '按下Space键后停止飞行';
  stopText.style.textAlign = 'center';
  stopText.style.margin = '5px 0';
  stopText.style.fontSize = '16px';
  panel.appendChild(stopText);
  
  document.body.appendChild(panel);
}

// 创建说明面板
createInstructionPanel();

// 确保星空可见
setTimeout(() => {
  const starfield = scene.getObjectByName("starfield");
  if (starfield) {
    console.log("星空对象状态:", {
      可见性: starfield.visible,
      位置: starfield.position,
      星星数量: starfield.geometry.attributes.position.count,
      材质设置: {
        size: starfield.material.size,
        透明度: starfield.material.opacity,
        深度测试: starfield.material.depthTest
      }
    });
    
    // 强制设置为可见
    starfield.visible = true;
    starfield.material.needsUpdate = true;
  } else {
    console.log("未找到星空对象！");
  }
}, 2000);

// 在createSolarSystem.js中已经创建了太阳光源，需要调整其范围
// 获取太阳光源并修改其范围
const sunLight = solarSystem.children.find(child => child instanceof THREE.PointLight);
if (sunLight) {
  // 设置光源范围与强度，与createSolarSystem.js中保持一致
  sunLight.distance = 10000000000; // 扩大500倍(原来2000000000)
  sunLight.intensity = 1000000; // 扩大50倍(原来200000)
  console.log("已调整太阳光源范围:", sunLight.distance, "强度:", sunLight.intensity);
}