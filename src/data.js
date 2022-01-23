import {MAP_CENTER} from "./globals";

//===========================================================================
//                              读取 JSON
//===========================================================================
import * as data1 from "./data/china-map.json";
import data2 from "./data/elite.json";  // 共 74445 人, 其中 73403 人落入 618 ~ 1911 区间


//===========================================================================
//                        地图数据 (各个省份的轮廓)
//===========================================================================

// 获取地图数据
const CHINA_MAP_JSON = data1;   // Make compiler happy
function getChinaMapJSON() {
  return CHINA_MAP_JSON
}

// 获取关于某点旋转的映射
function __getRotateThenResizeThenMoveFunction(x0, y0, angle, scale, move_x, move_y) {
  return (vec) => {
    let dx = vec[0] - x0
    let dy = vec[1] - y0
    let theta = angle / 360 * 2 * Math.PI
    let cos = Math.cos(theta)
    let sin = Math.sin(theta)
    let new_dx = cos * dx - sin * dy
    let new_dy = sin * dx + cos * dy
    return [x0 + new_dx * scale + move_x, y0 + new_dy * scale + move_y]
  }
}

// 把 CBDB 的经纬度映射到下载的中国地图的经纬度 (手动调参...)
let f_reviseCoordinates = __getRotateThenResizeThenMoveFunction(
  ...MAP_CENTER,
  -3,         // 角度
  0.93,       // 缩放
  1.5, -2     // 平移
)

//===========================================================================
//                           精英数据预处理
//===========================================================================
// 精英数据预处理 (添加位置获取函数, 修正经纬度坐标)
const ELITE_DATA = data2.map(d => {     // 读取精英数据, 并附加位置获取函数
  let d_copy = {...d}                           // 避免修改原数据
  for (let year_xy of d_copy.year_location) {   // 重映射坐标点以适应地图
    [year_xy.x, year_xy.y] = f_reviseCoordinates([year_xy.x, year_xy.y])
  }
  function getPos(year) {                       // 定义位置获取函数
    for (let year_xy of d_copy.year_location) {
      if (year <= year_xy.year) {               // 找到第一个符合条件的年份
        return [year_xy.x, year_xy.y]           // 返回当时的位置
      }
    }
    return [d_copy.year_location[0].x, d_copy.year_location[0].y]
  }
  d_copy.getPos = getPos                // 附加位置获取函数
  return d_copy
})


// 机能不足, 采样一部分的数据 (供 CPU 版本使用)
const ELITE_DATA_LITE = ELITE_DATA.filter((d, i) => !(i % 10))


//===========================================================================
//                              筛选精英数据
//===========================================================================

// 获取 [根据年份和精英类别筛选后的] 精英数据
function getFilteredElites({type, year, useLiteData}) {     // 什么类别?  哪一年?  是否使用部分数据?
  let list = useLiteData ? ELITE_DATA_LITE : ELITE_DATA;
  if (year) {   // 按年份筛
    list = list.filter((d)=> (d.birth_year <= year && year < d.death_year))
  }
  if (type) {   // 按类别筛
    list = list.filter((d)=>(d.type.includes(type)))
  }
  return list
}





export {getChinaMapJSON, getFilteredElites}