import * as THREE from "three";
import { getFresnelMat } from "./getFresnelMat.js";

/**
 * 创建完整的太阳系行星系统
 * @param {THREE.LoadingManager} loadingManager - 资源加载管理器
 * @param {Object} options - 配置选项
 * @returns {Object} 包含太阳系组和各个行星组的对象
 */
function createSolarSystem(loadingManager = null, options = {}) {
  // 使用传入的loadingManager或创建新的
  const textureLoader = new THREE.TextureLoader(loadingManager);
  
  // 创建太阳系统根组
  const solarSystem = new THREE.Group();
  
  // 创建太阳
  const sunGeometry = new THREE.IcosahedronGeometry(100 * 1.5, 15);
  
  // 创建自定义着色器材质，实现太阳表面的明亮效果和红色耀斑
  const sunShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      sunTexture: { value: textureLoader.load("./textures/sunmap.jpg") },
      sunColor: { value: new THREE.Color(0xffaa00) },
      flareColor: { value: new THREE.Color(0xff2200) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform sampler2D sunTexture;
      uniform vec3 sunColor;
      uniform vec3 flareColor;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      // 噪声函数
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float n = i.x + i.y * 157.0 + 113.0 * i.z;
        return mix(
          mix(
            mix(fract(sin(n + 0.0) * 43758.5453), fract(sin(n + 1.0) * 43758.5453), f.x),
            mix(fract(sin(n + 157.0) * 43758.5453), fract(sin(n + 158.0) * 43758.5453), f.x),
            f.y
          ),
          mix(
            mix(fract(sin(n + 113.0) * 43758.5453), fract(sin(n + 114.0) * 43758.5453), f.x),
            mix(fract(sin(n + 270.0) * 43758.5453), fract(sin(n + 271.0) * 43758.5453), f.x),
            f.y
          ),
          f.z
        );
      }
      
      void main() {
        // 基础纹理
        vec4 texColor = texture2D(sunTexture, vUv);
        
        // 创建动态噪声，用于太阳耀斑和表面扰动
        float noiseScale = 2.0;
        float noiseTime = time * 0.2;
        vec3 noisePos = vPosition * noiseScale + noiseTime;
        float n = noise(noisePos);
        float n2 = noise(noisePos * 2.0 + vec3(noiseTime));
        
        // 创建红色耀斑效果
        float flareIntensity = pow(n, 3.0) * pow(n2, 2.0) * 2.0;
        
        // 创建表面明亮效果
        float brightSpot = pow(max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0))), 0.6);
        
        // 合并颜色
        vec3 finalColor = texColor.rgb * sunColor;
        finalColor += flareColor * flareIntensity;
        finalColor *= (1.0 + brightSpot * 0.6);
        
        // 增强整体亮度
        finalColor = pow(finalColor, vec3(0.8)) * 1.5;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    transparent: false,
    depthWrite: true
  });

  // 不再使用旧的sunMaterial
  // const sunMaterial = new THREE.MeshStandardMaterial({...});

  const sunMesh = new THREE.Mesh(sunGeometry, sunShaderMaterial);
  solarSystem.add(sunMesh);
  
  // 添加太阳辉光效果
  const sunGlowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0xffcc22) }
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
        gl_FragColor = vec4(color, 1.0) * intensity;
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
  });
  
  // 添加第二层内部发光效果
  const sunCoreGeometry = new THREE.IcosahedronGeometry(95 * 1.5, 15);
  const sunCoreMaterial = new THREE.MeshBasicMaterial({
    map: textureLoader.load("./textures/sunmap.jpg"),
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.6
  });

  const sunCoreMesh = new THREE.Mesh(sunCoreGeometry, sunCoreMaterial);
  sunCoreMesh.scale.setScalar(0.99); // 略小于主太阳
  solarSystem.add(sunCoreMesh);

  const sunGlowMesh = new THREE.Mesh(sunGeometry, sunGlowMaterial);
  sunGlowMesh.scale.setScalar(1.3);
  solarSystem.add(sunGlowMesh);

  // 为太阳添加专门的光源
  const sunSurfaceLight = new THREE.PointLight(0xffffaa, 500.0, 500); // 增大表面光强度和范围
  sunSurfaceLight.position.set(0, 0, 0);
  sunMesh.add(sunSurfaceLight);
  
  // 添加太阳光源
  const sunLight = new THREE.PointLight(0xffffff, 1000000.0, 10000000000); // 增大光源强度50倍，范围扩大500倍
  sunLight.position.set(0, 0, 0); // 光源位于太阳中心
  solarSystem.add(sunLight);
  
  // 太阳半径
  const SUN_RADIUS = 100 * 1.5; // 太阳半径作为基准
  
  // 基础单位 - 用于调整整体尺度
  const AU_SCALE = 400; // 天文单位的缩放比例，从250增加到400
  
  // 各行星平均距离太阳的天文单位值（真实数据）
  const MERCURY_AU = 0.39;
  const VENUS_AU = 0.72;
  const EARTH_AU = 1.0;
  const MARS_AU = 1.52;
  const JUPITER_AU = 5.2;
  const SATURN_AU = 9.54;
  const URANUS_AU = 19.2;
  const NEPTUNE_AU = 30.06;
  const PLUTO_AU = 39.5;
  
  // 各行星相对地球半径的比例（真实数据）
  const EARTH_RADIUS = 10; // 地球半径作为基准
  const MERCURY_RADIUS_RATIO = 0.38;
  const VENUS_RADIUS_RATIO = 0.95;
  const MARS_RADIUS_RATIO = 0.53;
  const JUPITER_RADIUS_RATIO = 11.2;
  const SATURN_RADIUS_RATIO = 9.45;
  const URANUS_RADIUS_RATIO = 4.0;
  const NEPTUNE_RADIUS_RATIO = 3.88;
  const PLUTO_RADIUS_RATIO = 0.18;
  const MOON_RADIUS_RATIO = 0.27; // 相对地球
  
  // ============== 水星 ==============
  // 按照真实比例：水星直径约为地球的0.38倍，距离太阳约0.39AU
  const mercurySystem = new THREE.Group();
  solarSystem.add(mercurySystem);
  
  const mercuryGeometry = new THREE.IcosahedronGeometry(EARTH_RADIUS * MERCURY_RADIUS_RATIO, 8);
  const mercuryMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load("./textures/mercury/mercurymapthumb.jpg"),
    bumpMap: textureLoader.load("./textures/mercury/mercurybumpthumb.jpg"),
    bumpScale: 0.04,
    transparent: false // 确保不透明
  });
  
  const mercuryMesh = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
  mercurySystem.add(mercuryMesh);
  
  // 水星光晕
  const mercuryGlowMesh = new THREE.Mesh(
    mercuryGeometry, 
    getFresnelMat(new THREE.Color(0x777777))
  );
  mercuryGlowMesh.scale.setScalar(1.01);
  mercurySystem.add(mercuryGlowMesh);
  
  // 水星的轨道距离
  mercurySystem.position.set(AU_SCALE * MERCURY_AU, 0, 0);
  
  // ============== 金星 ==============
  // 按照真实比例：金星直径约为地球的0.95倍，距离太阳约0.72AU
  const venusSystem = new THREE.Group();
  solarSystem.add(venusSystem);
  
  const venusGeometry = new THREE.IcosahedronGeometry(EARTH_RADIUS * VENUS_RADIUS_RATIO, 8);
  const venusMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load("./textures/venus/venusmapthumb.jpg"),
    bumpMap: textureLoader.load("./textures/venus/venusbumpthumb.jpg"),
    bumpScale: 0.04,
    transparent: false // 确保不透明
  });
  
  const venusMesh = new THREE.Mesh(venusGeometry, venusMaterial);
  venusSystem.add(venusMesh);
  
  // 金星光晕 - 黄色调，模拟其厚重大气层反射阳光
  const venusGlowMesh = new THREE.Mesh(
    venusGeometry, 
    getFresnelMat(new THREE.Color(0xbbaa77))
  );
  venusGlowMesh.scale.setScalar(1.02); // 金星光晕稍大，模拟厚厚的大气层
  venusSystem.add(venusGlowMesh);
  
  // 金星的轨道距离
  venusSystem.position.set(AU_SCALE * VENUS_AU, 0, 0);
  
  // ============== 地球 ==============
  // 地球系统在主index.js中定义，这里不需要再定义
  const earthSystem = new THREE.Group();
  solarSystem.add(earthSystem);
  
  // 地球组
  const earthGroup = new THREE.Group();
  earthGroup.rotation.z = -23.4 * Math.PI / 180; // 地球倾斜角度
  earthSystem.add(earthGroup);
  
  const earthGeometry = new THREE.IcosahedronGeometry(EARTH_RADIUS, 12);
  const earthMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load("./textures/00_earthmap1k.jpg"),
    specularMap: textureLoader.load("./textures/02_earthspec1k.jpg"),
    bumpMap: textureLoader.load("./textures/01_earthbump1k.jpg"),
    bumpScale: 0.04,
    transparent: false // 确保不透明
  });
  
  const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  earthGroup.add(earthMesh);
  
  const lightsMat = new THREE.MeshBasicMaterial({
    map: textureLoader.load("./textures/03_earthlights1k.jpg"),
    blending: THREE.AdditiveBlending,
  });
  
  const lightsMesh = new THREE.Mesh(earthGeometry, lightsMat);
  earthGroup.add(lightsMesh);
  
  const cloudsMat = new THREE.MeshStandardMaterial({
    map: textureLoader.load("./textures/04_earthcloudmap.jpg"),
    transparent: true,
    opacity: 0.7,
    alphaMap: textureLoader.load('./textures/05_earthcloudmaptrans.jpg'),
  });
  
  const cloudsMesh = new THREE.Mesh(earthGeometry, cloudsMat);
  cloudsMesh.scale.setScalar(1.003);
  earthGroup.add(cloudsMesh);
  
  // 地球大气层光晕
  const earthGlowMesh = new THREE.Mesh(
    earthGeometry, 
    getFresnelMat(new THREE.Color(0x6699ff))
  );
  earthGlowMesh.scale.setScalar(1.01);
  earthGroup.add(earthGlowMesh);
  
  // 地球位置
  earthSystem.position.set(AU_SCALE * EARTH_AU, 0, 0);
  
  // ============== 月球 ==============
  const moonSystem = new THREE.Group();
  earthSystem.add(moonSystem);
  
  const moonGeometry = new THREE.IcosahedronGeometry(EARTH_RADIUS * MOON_RADIUS_RATIO, 8);
  const moonMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load("./textures/moonmapthumb.jpg"),
    bumpMap: textureLoader.load("./textures/moonbumpthumb2.jpg"),
    bumpScale: 0.02,
    transparent: false // 确保不透明
  });
  
  const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
  moonSystem.add(moonMesh);
  
  const moonGlowMesh = new THREE.Mesh(
    moonGeometry, 
    getFresnelMat(new THREE.Color(0x888888))
  );
  moonGlowMesh.scale.setScalar(1.01);
  moonSystem.add(moonGlowMesh);
  
  // 月球轨道距离（相对地球）- 实际约为地球-月球距离为地球半径的60倍
  moonSystem.position.set(EARTH_RADIUS * 2.5, 0, 0);
  
  // ============== 火星 ==============
  // 按照真实比例：火星直径约为地球的0.53倍，距离太阳约1.52AU
  const marsSystem = new THREE.Group();
  solarSystem.add(marsSystem);
  
  const marsGeometry = new THREE.IcosahedronGeometry(EARTH_RADIUS * MARS_RADIUS_RATIO, 8);
  const marsMaterial = new THREE.MeshStandardMaterial({
    map: textureLoader.load("./textures/mars/mars_thumbnail.jpg"),
    normalMap: textureLoader.load("./textures/mars/mars_normal_thumbnail.jpg"),
    normalScale: new THREE.Vector2(0.8, 0.8),
    metalnessMap: textureLoader.load("./textures/mars/mars_topo_thumbnail.jpg"),
    metalness: 0.3,
    roughness: 0.7,
    transparent: false // 确保不透明
  });
  
  const marsMesh = new THREE.Mesh(marsGeometry, marsMaterial);
  marsSystem.add(marsMesh);
  
  // 火星周围的淡红色光晕，模拟尘埃层
  const marsGlowMesh = new THREE.Mesh(
    marsGeometry, 
    getFresnelMat(new THREE.Color(0xaa5533))
  );
  marsGlowMesh.scale.setScalar(1.01);
  marsSystem.add(marsGlowMesh);
  
  // 火星的轨道距离
  marsSystem.position.set(AU_SCALE * MARS_AU, 0, 0);
  
  // ============== 木星 ==============
  // 按照真实比例：木星直径约为地球的11倍，距离太阳约5.2AU
  const jupiterSystem = new THREE.Group();
  solarSystem.add(jupiterSystem);
  
  const jupiterGeometry = new THREE.IcosahedronGeometry(EARTH_RADIUS * JUPITER_RADIUS_RATIO, 10);
  const jupiterMaterial = new THREE.MeshStandardMaterial({
    map: textureLoader.load("./textures/jupiter/jupitermapthumb.jpg"),
    bumpScale: 0.02,
    emissive: new THREE.Color(0x553311),
    emissiveIntensity: 0.35,
    roughness: 0.7,
    metalness: 0.3,
    transparent: false // 确保不透明
  });
  
  const jupiterMesh = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
  jupiterSystem.add(jupiterMesh);
  
  // 木星光晕 - 增强光晕效果
  const jupiterGlowMesh = new THREE.Mesh(
    jupiterGeometry, 
    getFresnelMat({rimHex: 0xffcc88, facingHex: 0x331100})
  );
  jupiterGlowMesh.scale.setScalar(1.03);
  jupiterSystem.add(jupiterGlowMesh);
  
  // 木星的轨道距离
  jupiterSystem.position.set(AU_SCALE * JUPITER_AU, 0, 0);
  
  // ============== 土星 ==============
  // 按照真实比例：土星直径约为地球的9.5倍，距离太阳约9.6AU
  const saturnSystem = new THREE.Group();
  solarSystem.add(saturnSystem);
  
  const saturnGeometry = new THREE.IcosahedronGeometry(EARTH_RADIUS * SATURN_RADIUS_RATIO, 10);
  const saturnMaterial = new THREE.MeshStandardMaterial({
    map: textureLoader.load("./textures/saturn/saturnmapthumb.jpg"),
    bumpScale: 0.02,
    emissive: new THREE.Color(0x554422),
    emissiveIntensity: 0.35,
    roughness: 0.7,
    metalness: 0.3,
    transparent: false // 确保不透明
  });
  
  const saturnMesh = new THREE.Mesh(saturnGeometry, saturnMaterial);
  saturnSystem.add(saturnMesh);
  
  // 土星环 - 增强发光效果
  const saturnRingGeometry = createRingGeometry(EARTH_RADIUS * SATURN_RADIUS_RATIO * 1.2, EARTH_RADIUS * SATURN_RADIUS_RATIO * 2.2, 160);
  const saturnRingMaterial = new THREE.MeshStandardMaterial({
    map: textureLoader.load("./textures/saturn/saturnringcolorthumb.jpg"),
    transparent: true,
    alphaMap: textureLoader.load("./textures/saturn/saturnringpatternthumb.gif"),
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0xddccaa), // 增强自发光颜色
    emissiveIntensity: 0.6, // 增加自发光强度
    opacity: 0.95 // 增加不透明度
  });
  
  const saturnRingMesh = new THREE.Mesh(saturnRingGeometry, saturnRingMaterial);
  saturnRingMesh.rotation.x = Math.PI / 2 + Math.PI / 6; // 倾斜30度 (Math.PI/6 = 30度)
  saturnSystem.add(saturnRingMesh);
  
  // 土星光晕
  const saturnGlowMesh = new THREE.Mesh(
    saturnGeometry, 
    getFresnelMat(new THREE.Color(0xddcc99))
  );
  saturnGlowMesh.scale.setScalar(1.01);
  saturnSystem.add(saturnGlowMesh);
  
  // 土星的轨道距离
  saturnSystem.position.set(AU_SCALE * SATURN_AU, 0, 0);
  
  // ============== 天王星 ==============
  // 按照真实比例：天王星直径约为地球的4倍，距离太阳约19.2AU
  const uranusSystem = new THREE.Group();
  solarSystem.add(uranusSystem);
  
  const uranusGeometry = new THREE.IcosahedronGeometry(EARTH_RADIUS * URANUS_RADIUS_RATIO, 8);
  const uranusMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load("./textures/uranus/uranusmapthumb.jpg"),
    bumpScale: 0.02,
    color: 0xc0ffff, // 增加青绿色调
    transparent: false // 确保不透明
  });
  
  const uranusMesh = new THREE.Mesh(uranusGeometry, uranusMaterial);
  uranusSystem.add(uranusMesh);
  
  // 天王星环
  const uranusRingGeometry = createRingGeometry(EARTH_RADIUS * URANUS_RADIUS_RATIO * 1.4, EARTH_RADIUS * URANUS_RADIUS_RATIO * 2.2, 100);
  const uranusRingMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load("./textures/uranus/uranusringcolour.jpg"),
    transparent: true,
    alphaMap: textureLoader.load("./textures/uranus/uranusringtrans.jpg"),
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0xaaffff), // 添加自发光，青色
    emissiveIntensity: 0.4, // 增加亮度
    opacity: 0.9 // 增加不透明度
  });
  
  const uranusRingMesh = new THREE.Mesh(uranusRingGeometry, uranusRingMaterial);
  uranusRingMesh.rotation.x = Math.PI / 1.2; // 天王星环几乎垂直于轨道平面
  uranusSystem.add(uranusRingMesh);
  
  // 天王星光晕
  const uranusGlowMesh = new THREE.Mesh(
    uranusGeometry, 
    getFresnelMat(new THREE.Color(0x00ffcc))
  );
  uranusGlowMesh.scale.setScalar(1.01);
  uranusSystem.add(uranusGlowMesh);
  
  // 天王星的轨道距离
  uranusSystem.position.set(AU_SCALE * URANUS_AU, 0, 0);
  
  // ============== 海王星 ==============
  // 按照真实比例：海王星直径约为地球的3.9倍，距离太阳约30AU
  const neptuneSystem = new THREE.Group();
  solarSystem.add(neptuneSystem);
  
  const neptuneGeometry = new THREE.IcosahedronGeometry(EARTH_RADIUS * NEPTUNE_RADIUS_RATIO, 8);
  const neptuneMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load("./textures/neptune/neptunemapthumb.jpg"),
    bumpScale: 0.02,
    color: 0x4444ff, // 增加蓝色调
    transparent: false // 确保不透明
  });
  
  const neptuneMesh = new THREE.Mesh(neptuneGeometry, neptuneMaterial);
  neptuneSystem.add(neptuneMesh);
  
  // 海王星光晕
  const neptuneGlowMesh = new THREE.Mesh(
    neptuneGeometry, 
    getFresnelMat(new THREE.Color(0x0099ff))
  );
  neptuneGlowMesh.scale.setScalar(1.01);
  neptuneSystem.add(neptuneGlowMesh);
  
  // 海王星的轨道距离
  neptuneSystem.position.set(AU_SCALE * NEPTUNE_AU, 0, 0);
  
  // ============== 冥王星 ==============
  // 按照真实比例：冥王星直径约为地球的0.18倍，距离太阳约39.5AU
  const plutoSystem = new THREE.Group();
  solarSystem.add(plutoSystem);
  
  const plutoGeometry = new THREE.IcosahedronGeometry(EARTH_RADIUS * PLUTO_RADIUS_RATIO, 7);
  const plutoMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load("./textures/pluto/plutomapthumb.jpg"),
    bumpMap: textureLoader.load("./textures/pluto/plutobumpthumb.jpg"),
    bumpScale: 0.04,
    transparent: false // 确保不透明
  });
  
  const plutoMesh = new THREE.Mesh(plutoGeometry, plutoMaterial);
  plutoSystem.add(plutoMesh);
  
  // 冥王星光晕
  const plutoGlowMesh = new THREE.Mesh(
    plutoGeometry, 
    getFresnelMat(new THREE.Color(0x777788))
  );
  plutoGlowMesh.scale.setScalar(1.01);
  plutoSystem.add(plutoGlowMesh);
  
  // 冥王星的轨道距离
  plutoSystem.position.set(AU_SCALE * PLUTO_AU, 0, 0);
  
  // 添加太阳表面耀斑环
  const solarFlareRingGeometry = new THREE.TorusGeometry(140 * 1.5, 15 * 1.5, 20, 100);
  const solarFlareRingMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      color: { value: new THREE.Color(0xff3300) }
    },
    vertexShader: `
      uniform float time;
      varying vec3 vPosition;
      
      void main() {
        // 添加基于时间的波动，增加波动幅度
        vec3 pos = position;
        float wave = sin(position.x * 5.0 + time * 2.0) * cos(position.y * 5.0 + time * 3.0) * 0.7;
        pos.x += wave * 4.0;
        pos.y += wave * 4.0;
        pos.z += wave * 4.0;
        
        vPosition = pos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float time;
      varying vec3 vPosition;
      
      void main() {
        vec3 pos = vPosition;
        
        // 创建动态闪烁的耀斑，增强效果
        float flicker = sin(time * 10.0 + pos.x * 0.5) * cos(time * 8.0 + pos.y * 0.5) * 0.7 + 0.6;
        
        // 随时间淡入淡出，但保持较高基础亮度
        float fadeOut = sin(time * 0.5) * 0.4 + 0.6;
        
        vec3 finalColor = color * (flicker * fadeOut) * 1.5; // 增加整体亮度
        float alpha = flicker * fadeOut * 0.8; // 增加不透明度
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  
  const solarFlareRing = new THREE.Mesh(solarFlareRingGeometry, solarFlareRingMaterial);
  // 随机旋转环，使其不完全对齐
  solarFlareRing.rotation.x = Math.PI / 4;
  solarFlareRing.rotation.y = Math.PI / 5;
  solarSystem.add(solarFlareRing);
  
  // 添加第二个耀斑环，旋转方向不同
  const solarFlareRing2 = new THREE.Mesh(solarFlareRingGeometry, solarFlareRingMaterial);
  solarFlareRing2.rotation.x = Math.PI / 3;
  solarFlareRing2.rotation.z = Math.PI / 2;
  solarSystem.add(solarFlareRing2);
  
  // 添加太阳大气光晕效果
  const sunAtmosphereGeometry = new THREE.SphereGeometry(120 * 1.5, 32, 32);
  const sunAtmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      baseColor: { value: new THREE.Color(0xffaa33) },
      glowColor: { value: new THREE.Color(0xff5500) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 baseColor;
      uniform vec3 glowColor;
      uniform float time;
      
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      void main() {
        // 计算视角方向
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        
        // 获取法线和视角方向之间的点积
        float rimEffect = 1.0 - dot(vNormal, viewDir);
        
        // 应用圆形功率函数使边缘更加明显
        rimEffect = pow(rimEffect, 2.0);
        
        // 添加时间变化的噪声
        float noise = sin(time * 2.0 + vWorldPosition.x * 0.1) * 
                     cos(time * 1.5 + vWorldPosition.y * 0.1) * 
                     sin(time + vWorldPosition.z * 0.1);
        
        // 扰动边缘效果
        rimEffect += noise * 0.1;
        
        // 计算最终颜色
        vec3 finalColor = mix(baseColor, glowColor, rimEffect);
        
        // 设置透明度基于边缘效果
        float alpha = rimEffect * 0.8;
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  });

  const sunAtmosphere = new THREE.Mesh(sunAtmosphereGeometry, sunAtmosphereMaterial);
  solarSystem.add(sunAtmosphere);
  
  // 添加太阳喷发粒子效果
  const sunEruptionGeometry = new THREE.BufferGeometry();
  const particleCount = 150;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const velocities = [];
  const lifeTimes = [];

  // 初始化粒子数据
  for (let i = 0; i < particleCount; i++) {
    // 将粒子放置在太阳表面
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 100; // 太阳半径
    
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
    
    // 设置颜色 (橙色到红色)
    colors[i * 3] = 1.0; // R
    colors[i * 3 + 1] = 0.3 + Math.random() * 0.4; // G
    colors[i * 3 + 2] = Math.random() * 0.2; // B
    
    // 设置大小
    sizes[i] = 2 + Math.random() * 3;
    
    // 设置向外的速度
    const vx = positions[i * 3] * 0.01;
    const vy = positions[i * 3 + 1] * 0.01;
    const vz = positions[i * 3 + 2] * 0.01;
    velocities.push({ x: vx, y: vy, z: vz });
    
    // 设置生命周期
    const lifetime = 1 + Math.random() * 3;
    lifeTimes.push({ current: Math.random() * lifetime, max: lifetime });
  }

  // 配置几何体
  sunEruptionGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  sunEruptionGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  sunEruptionGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // 创建材质
  const sunEruptionMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      
      void main() {
        // 创建圆形点
        float r = distance(gl_PointCoord, vec2(0.5, 0.5));
        if (r > 0.5) discard;
        
        // 亮边缘效果
        float intensity = 1.0 - 2.0 * r;
        gl_FragColor = vec4(vColor * intensity, intensity);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    vertexColors: true
  });

  // 创建粒子系统
  const sunEruptionParticles = new THREE.Points(sunEruptionGeometry, sunEruptionMaterial);
  solarSystem.add(sunEruptionParticles);

  // 创建用于更新的对象
  const sunEruptionSystem = {
    positions: positions,
    velocities: velocities,
    lifeTimes: lifeTimes,
    sizes: sizes,
    particleCount: particleCount,
    geometry: sunEruptionGeometry,
    
    update: function(delta) {
      for (let i = 0; i < this.particleCount; i++) {
        // 更新生命周期
        this.lifeTimes[i].current -= delta;
        
        if (this.lifeTimes[i].current <= 0) {
          // 重置粒子
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const radius = 100; // 太阳半径
          
          this.positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
          this.positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
          this.positions[i * 3 + 2] = radius * Math.cos(phi);
          
          // 新的速度
          this.velocities[i].x = this.positions[i * 3] * 0.01;
          this.velocities[i].y = this.positions[i * 3 + 1] * 0.01;
          this.velocities[i].z = this.positions[i * 3 + 2] * 0.01;
          
          // 重置生命周期
          this.lifeTimes[i].max = 1 + Math.random() * 3;
          this.lifeTimes[i].current = this.lifeTimes[i].max;
          
          // 新的大小
          this.sizes[i] = 2 + Math.random() * 3;
        } else {
          // 更新位置
          this.positions[i * 3] += this.velocities[i].x * delta * 15;
          this.positions[i * 3 + 1] += this.velocities[i].y * delta * 15;
          this.positions[i * 3 + 2] += this.velocities[i].z * delta * 15;
          
          // 基于生命周期调整大小
          const lifeRatio = this.lifeTimes[i].current / this.lifeTimes[i].max;
          this.sizes[i] = (2 + Math.random() * 3) * lifeRatio;
        }
      }
      
      // 更新几何体
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.size.needsUpdate = true;
    }
  };
  
  // 创建行星标签的通用函数
  function createPlanetLabel(name, chineseName, planetSystem, planetRadius) {
    // 创建一个绘图画布
    const canvas = document.createElement('canvas');
    canvas.width = 512; // 增加画布宽度，从256到512
    canvas.height = 128;
    const context = canvas.getContext('2d');
    
    // 计算标签大小比例 - 基于行星半径，但进行非线性缩放以避免过大或过小
    // 地球为基准(半径=10)，标签基本大小为50x25
    const BASE_SIZE = 50;
    const sizeRatio = Math.pow(planetRadius / EARTH_RADIUS, 0.5); // 开平方根使缩放更合理
    const labelWidth = BASE_SIZE * sizeRatio * 2; // 增加标签宽度
    const labelHeight = 25 * sizeRatio;
    
    // 计算字体大小
    const fontSize = Math.max(30, Math.min(60, 40 * sizeRatio));
    
    // 设置文本样式
    context.font = `bold ${fontSize}px Arial`;
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // 绘制文本
    const labelText = `${name}(${chineseName})`;
    context.fillText(labelText, 256, 64); // x坐标改为画布中心
    
    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    
    // 创建材质
    const labelMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    
    // 创建精灵
    const label = new THREE.Sprite(labelMaterial);
    
    // 计算标签位置 - 大行星标签放置更高
    const labelYOffset = planetRadius * 2.5; // 增加垂直偏移
    label.position.set(0, labelYOffset, 0);
    
    // 设置标签大小
    label.scale.set(labelWidth, labelHeight, 1);
    
    // 添加到行星系统
    planetSystem.add(label);
    
    return label;
  }
  
  // 为太阳添加标签
  createPlanetLabel('Sun', '太阳', solarSystem, SUN_RADIUS);
  
  // 为水星添加标签
  createPlanetLabel('Mercury', '水星', mercurySystem, EARTH_RADIUS * MERCURY_RADIUS_RATIO);
  
  // 为金星添加标签
  createPlanetLabel('Venus', '金星', venusSystem, EARTH_RADIUS * VENUS_RADIUS_RATIO);
  
  // 为地球添加标签
  createPlanetLabel('Earth', '地球', earthSystem, EARTH_RADIUS);
  
  // 为月球添加标签
  createPlanetLabel('Moon', '月球', moonSystem, EARTH_RADIUS * MOON_RADIUS_RATIO);
  
  // 为火星添加标签
  createPlanetLabel('Mars', '火星', marsSystem, EARTH_RADIUS * MARS_RADIUS_RATIO);
  
  // 为木星添加标签
  createPlanetLabel('Jupiter', '木星', jupiterSystem, EARTH_RADIUS * JUPITER_RADIUS_RATIO);
  
  // 为土星添加标签
  createPlanetLabel('Saturn', '土星', saturnSystem, EARTH_RADIUS * SATURN_RADIUS_RATIO);
  
  // 为天王星添加标签
  createPlanetLabel('Uranus', '天王星', uranusSystem, EARTH_RADIUS * URANUS_RADIUS_RATIO);
  
  // 为海王星添加标签
  createPlanetLabel('Neptune', '海王星', neptuneSystem, EARTH_RADIUS * NEPTUNE_RADIUS_RATIO);
  
  // 为冥王星添加标签
  createPlanetLabel('Pluto', '冥王星', plutoSystem, EARTH_RADIUS * PLUTO_RADIUS_RATIO);
  
  // 导出更新后的对象引用
  return {
    solarSystem,
    sunMesh,
    sunCoreMesh,
    sunGlowMesh,
    sunShaderMaterial,
    solarFlareRingMaterial,
    sunAtmosphereMaterial,
    sunEruptionSystem,
    mercurySystem,
    mercuryMesh,
    venusSystem,
    venusMesh,
    earthSystem,
    earthMesh: earthMesh,
    lightsMesh,
    cloudsMesh,
    earthGlowMesh,
    moonSystem,
    moonMesh,
    marsSystem,
    marsMesh,
    jupiterSystem,
    jupiterMesh,
    saturnSystem,
    saturnMesh,
    saturnRingMesh,
    uranusSystem,
    uranusMesh,
    uranusRingMesh,
    neptuneSystem,
    neptuneMesh,
    plutoSystem,
    plutoMesh
  };
}

/**
 * 创建环状几何体
 * @param {Number} innerRadius - 内半径
 * @param {Number} outerRadius - 外半径
 * @param {Number} segments - 分段数
 * @returns {THREE.BufferGeometry} 环状几何体
 */
function createRingGeometry(innerRadius, outerRadius, segments) {
  const geometry = new THREE.BufferGeometry();
  
  const vertices = [];
  const uvs = [];
  const indices = [];
  
  // 创建顶点和UV
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    
    // 内圈顶点
    vertices.push(innerRadius * cosTheta, 0, innerRadius * sinTheta);
    uvs.push(i / segments, 0);
    
    // 外圈顶点
    vertices.push(outerRadius * cosTheta, 0, outerRadius * sinTheta);
    uvs.push(i / segments, 1);
  }
  
  // 创建面索引
  for (let i = 0; i < segments; i++) {
    const baseIndex = i * 2;
    
    // 两个三角形组成一个矩形面
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
    indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
  }
  
  // 设置属性
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

export default createSolarSystem; 