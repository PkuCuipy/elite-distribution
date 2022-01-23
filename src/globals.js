
import { GPU } from 'gpu.js';
const gpu = new GPU();    // 创建 GPU 实例

//===========================================================================
//                            初始值 / 固定值
//===========================================================================
const DEFAULT_USE_GPU = false
const DEFAULT_KERNEL_WIDTH = 1.0;
const DEFAULT_YEAR_SELECTED = 1051;
const DEFAULT_ARROW_ANGLE = 27;
const DEFAULT_ARROW_LENGTH = 10;
const DEFAULT_ELITE_TYPE = "进士";
const FIXED_ARROW_ORIGIN = [115.91, 31.38];
const MAP_CENTER = [104, 38];   // 地图中心点经纬度 (写死)
const MAP_UP = 14.39, MAP_DOWN = 55.80, MAP_LEFT = 72.72, MAP_RIGHT = 135.12;   // 地图经纬度范围 (估计值, 写死)
const YEAR_MIN = 618
const YEAR_MAX = 1911
const ELITE_AMOUNT_MAX = 80000    // FIXME: 这是对 CBDB 的数据而言的, GPU kernel 指定最大循环次数会用到这个值.
const THEME_COLOR = {
  进士: "#0099CC",
  郡望: "#1cbbbb",
  官职: "#7b70e0",
}
const EVENTS = [
  [618, "唐朝"],
  [907, "五代十国"],
  [960, "北宋"],
  [1127, "南宋"],
  [1276, "元朝"],
  [1368, "明朝"],
  [1636, "清朝"],
  [1911, "清朝结束(这个不要绘制!)"]
]

//===========================================================================
//                     二维数据向箭头投影, 得到一维数据
//===========================================================================
function getProjected1DPos(data_2d, arrow_radius, arrow_angle) {
  // arrow 的中心点
  let [x0, y0] = FIXED_ARROW_ORIGIN
  // 计算 arrow 的箭头端的坐标
  let theta = arrow_angle / 360 * Math.PI * 2
  let x = x0 + arrow_radius * Math.cos(theta)
  let y = y0 + arrow_radius * Math.sin(theta)
  // 计算 arrow 的箭头端相对中心点的向量
  let dx = x - x0
  let dy = y - y0
  // 对所有二维数据点进行投影
  let data = data_2d.map((d)=> {
    // point 的 x, y, dx, dy
    let pdx = d[0] - x0
    let pdy = d[1] - y0
    // 投影长度 = 点积 ÷ 方向向量长度 (即箭头的半径)
    return (pdx * dx + pdy * dy) / arrow_radius
  })
  return data
}


//===========================================================================
//                    生成 Arrow 的函数 (来自 Observable)
//===========================================================================
function generateArrow(x1, y1, x2, y2, flangeSize) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let px = y1 - y2;
  let py = x2 - x1;
  let plength = Math.sqrt(px * px + py * py);
  let pmultiplier = flangeSize / plength;
  const px1 = px * pmultiplier;
  const py1 = py * pmultiplier;
  const sx = dx * pmultiplier;
  const sy = dy * pmultiplier;
  return `M${x1}, ${y1}
          L${x2}, ${y2}
          M${x2 + px1 - sx}, ${y2 + py1 - sy}
          L${x2}, ${y2}
          L${x2 - px1 - sx}, ${y2 - py1 - sy}`;
}


//===========================================================================
//                      一元 KDE (密度函数的核估计)
//===========================================================================

//=================================
//     CPU Version  (2022-1-18)
//=================================
function __gauss_1d(sigma, x, mu) {     // 一元高斯 (相对值, 不带系数!)
  return Math.exp(-Math.pow(x - mu, 2) / (2 * Math.pow(sigma, 2)));
}
function kde_1d_cpu(bandwidth, grid_samples, points) {
  let density = grid_samples.map(d => [d, 0.0])
  for (let i = 0; i < grid_samples.length; i++) {
    let x = grid_samples[i]
    for (let j = 0; j < points.length; j++) {
      density[i][1] += Math.exp(-Math.pow(x - points[j], 2) / (2 * Math.pow(bandwidth, 2)));     // 一元高斯
    }
  }
  return density
}


//=================================
//     GPU Version  (2022-1-21)
//=================================
function kde_1d_gpu(bandwidth, grid_samples, points) {

  // 这里必须用反引号括起来! 否则 npm run build 之后的 minified 代码会让这个 kernel 出问题!!! 跑不起来了就!!!
  const kde_1d_kernel = gpu.createKernel( `function(samples, data, nPoints, sigma) {    // 创建 GPU kernel 程序
    let sum = 0.0;
    let x = samples[this.thread.x]
    for (let j = 0; j < nPoints; j++) {
      sum += Math.exp(-Math.pow(x - data[j], 2) / (2 * Math.pow(sigma, 2)));
    }
    return [samples[this.thread.x], sum];
  }`, {
    loopMaxIterations: ELITE_AMOUNT_MAX,       // 这里必须指定! 否则默认是1000! 不看文档的下场!! debug 一下午!!!
    output: [grid_samples.length],  // 设置线程数. 这里每个线程计算一个 sample 点处的 KDE 值
  });
  const kernel_output = kde_1d_kernel(grid_samples, points, points.length, Number(bandwidth));    // kernel launch
  return kernel_output;
}


//===========================================================================
//                      二元 KDE (密度函数的核估计)
//===========================================================================

//=================================
//     CPU Version  (2022-1-18)
//=================================
function __gauss_2d(sigma, vec1, vec2) {    // 二元高斯 (相对值, 不带系数!)
  return Math.exp(-(Math.pow(vec1[0]-vec2[0], 2) + Math.pow(vec1[1]-vec2[1], 2)) / (2 * Math.pow(sigma, 2)))
}
function kde_2d_cpu(kernel_width, samples, points) {
  let values = Array(samples.length).fill(0)
  for (let i = 0; i < samples.length; i++) {
    for (let j = 0; j < points.length; j++) {
      values[i] += __gauss_2d(kernel_width, samples[i], points[j]);
    }
  }
  return values
}


//=================================
//     GPU Version  (2022-1-21)
//=================================
function kde_2d_gpu(kernel_width, samples, points) {

  // 这里必须用反引号括起来! 否则 npm run build 之后的 minified 代码会让这个 kernel 出问题!!! 跑不起来了就!!!
  const kde_2d_kernel = gpu.createKernel( `function(samples, points, nPoints, sigma) {    // 创建 GPU kernel 程序
    let sum = 0.0;
    let [vec1x, vec1y] = samples[this.thread.x]
    for (let j = 0; j < nPoints; j++) {
      let [vec2x, vec2y] = points[j]
      sum += Math.exp(-(Math.pow(vec1x-vec2x, 2) + Math.pow(vec1y-vec2y, 2)) / (2 * Math.pow(sigma, 2)));
    }
    return sum;
  }`, {
      loopMaxIterations: ELITE_AMOUNT_MAX,  // 这里必须指定! 否则默认是1000! 不看文档的下场!! debug 一下午!!!
      output: [samples.length],             // 设置线程数. 这里每个线程计算一个 sample 点处的 KDE 值
  });
  const kernel_output = kde_2d_kernel(samples, points, points.length, Number(kernel_width));    // kernel launch
  return kernel_output;
}



export {
  DEFAULT_ELITE_TYPE,
  DEFAULT_YEAR_SELECTED,
  DEFAULT_KERNEL_WIDTH,
  DEFAULT_ARROW_ANGLE,
  DEFAULT_ARROW_LENGTH,
  FIXED_ARROW_ORIGIN,
  MAP_LEFT,
  MAP_RIGHT,
  MAP_UP,
  MAP_DOWN,
  MAP_CENTER,
  YEAR_MAX,
  YEAR_MIN,
  THEME_COLOR,
  EVENTS,
  DEFAULT_USE_GPU,
  generateArrow,
  kde_1d_gpu,
  kde_2d_gpu,
  kde_1d_cpu,
  kde_2d_cpu,
  getProjected1DPos,
}