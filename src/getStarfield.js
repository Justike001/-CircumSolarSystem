import * as THREE from "three";

/**
 * 创建星空背景
 * @param {Object} options - 配置选项
 * @returns {THREE.Points} 星空对象
 */
export default function getStarfield(options = {}) {
  // 限制星星的最大数量为5000，防止数组长度过大
  const numStars = Math.min(options.numStars || 500, 5000);
  
  function randomSpherePoint() {
    const radius = Math.random() * 3000 + 3000; // 大幅减小半径范围，使星星更靠近场景中心
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    let x = radius * Math.sin(phi) * Math.cos(theta);
    let y = radius * Math.sin(phi) * Math.sin(theta);
    let z = radius * Math.cos(phi);

    // 随机色调，添加一些红色和蓝色星星
    let hue;
    const colorType = Math.random();
    if (colorType < 0.7) {
      // 大多数是白色/蓝白色
      hue = 0.6 + Math.random() * 0.1;
    } else if (colorType < 0.85) {
      // 一些红色/橙色
      hue = Math.random() * 0.1;
    } else {
      // 一些青色/绿色
      hue = 0.3 + Math.random() * 0.2;
    }

    return {
      pos: new THREE.Vector3(x, y, z),
      hue: hue,
      minDist: radius,
    };
  }
  const verts = [];
  const colors = [];
  const positions = [];
  let col;
  for (let i = 0; i < numStars; i += 1) {
    let p = randomSpherePoint();
    const { pos, hue } = p;
    positions.push(p);
    
    // 增加饱和度，并随机亮度，使星星看起来更加明亮和多样化
    const saturation = 0.3 + Math.random() * 0.5;
    const lightness = 0.6 + Math.random() * 0.4;
    col = new THREE.Color().setHSL(hue, saturation, lightness);
    
    verts.push(pos.x, pos.y, pos.z);
    colors.push(col.r, col.g, col.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 15.0, // 增大星星的尺寸，使其更加明显
    vertexColors: true,
    map: new THREE.TextureLoader().load(
      "./textures/stars/circle.png"
    ),
    transparent: true,
    // 添加以下属性使星星看起来更亮
    blending: THREE.AdditiveBlending,
    depthTest: true, // 开启深度测试，确保星星能被行星遮挡
    depthWrite: true, // 开启深度写入
    opacity: 1.0 // 增加不透明度为最大值
  });
  const points = new THREE.Points(geo, mat);
  points.name = "starfield"; // 添加名称以便于调试
  console.log("创建了星空对象，星星数量:", numStars);
  return points;
}
