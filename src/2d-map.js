import * as d3 from "d3";
import {
  MAP_LEFT,
  MAP_RIGHT,
  MAP_UP,
  MAP_DOWN,
  MAP_CENTER,
  generateArrow,
  kde_2d_gpu,
  kde_2d_cpu, kde_1d_gpu,
} from "./globals";
import {getChinaMapJSON, getFilteredElites} from "./data";


//===========================================================================
//                      绘制二维 KDE 的 Contour 图
//===========================================================================
function drawContour(svg, year, type, kernel_width, grid_size, use_gpu) {

  // 获取符合条件的个体的 (x, y) 集合
  let filteredElites = getFilteredElites({type:type, year:year, useLiteData:!use_gpu})    // 使用 cpu 时使用少量数据
  let data = filteredElites.map((d)=>d.getPos(year))

  // SVG 画布长宽
  let width = svg.attr("width")
  let height = svg.attr("height")

  // 经纬度(x, y) 和网格 (i,j) 之间的映射
  let xScale = d3.scaleLinear()
    .domain([0, grid_size])
    .range([MAP_LEFT, MAP_RIGHT])
  let yScale = d3.scaleLinear()
    .domain([0, grid_size])
    .range([MAP_DOWN, MAP_UP])

  // 生成二维采样网格
  let samples = Array(grid_size ** 2)
  for (let i = 0; i < grid_size; i++) {
    for (let j = 0; j < grid_size; j++) {
      let x = xScale(j)   // 这里注意 i, j 分别对应 y, x!
      let y = yScale(i)
      samples[i * grid_size + j] = [x, y]
    }
  }

  // 计算采样值
  let kde_2d = use_gpu ? kde_2d_gpu : kde_2d_cpu      // 使用 CPU or GPU 版本的函数
  let values = kde_2d(kernel_width, samples, data);

  // 把 values 数组转换为 contour 数据
  let contours = d3.contours()
    .size([grid_size, grid_size])
    .thresholds(40)(values);      // Contour 设置多少个颜色阶段.

  const svg2 =
    svg.append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0, 0, ${grid_size}, ${grid_size}`)
      .attr("preserveAspectRatio", "none")

  const color = d3.scaleSequential(d3.interpolateTurbo)
    .domain(d3.extent(values))

  svg2.append("g")
    .attr("fill", "none")
    .selectAll("path")
    .data(contours)         // 这里喂进去 contour 数据
    .enter()
    .append("path")
    .attr("d", d3.geoPath())
    .style("fill", d => color(d.value))
  return svg2.node();
}


//===========================================================================
//                              绘制地图
//===========================================================================
function drawChinaMap(svg) {

  // 获取画布大小
  let canvas_height = svg.attr("height");
  let canvas_width = svg.attr("width");

  // 定义地图投影
  let scale = canvas_height * 1.09;
  let projection =
    d3.geoMercator()
      .center(MAP_CENTER)                      // 定义 [左上角] 的经纬度
      .translate([canvas_width / 2, canvas_height / 2])       // 把刚才的经纬度平移到中心
      .scale(scale)                             //设置缩放量

  // 定义地理路径生成器, 使每一个坐标都会先调用此投影, 才产生路径值
  let path = d3.geoPath()
    .projection(projection);    // 设定投影

  // 绘制省份轮廓
  svg.append("g")
    .selectAll("path")
    .data(getChinaMapJSON().features)      // 绑定数据
    .enter()
    .append("path")
    .style("fill", '#fff0')    //填充内部颜色
    .style("stroke", "#aaa")
    .attr("d", path)          //使用路径生成器

  // 绘制顶部坐标轴
  let xScale = d3.scaleLinear()
    .domain([MAP_LEFT, MAP_RIGHT])
    .range([0, canvas_width])
  let xAxis = d3.axisBottom()
    .scale(xScale)
    .tickValues([80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130]);
  svg.append("g")
    .call(xAxis)
    .attr("color", "#aaa")
    .call(g => g.select(".domain").remove())

  // 绘制左边坐标轴
  let yScale = d3.scaleLinear()
    .domain([MAP_DOWN, MAP_UP])
    .range([0, canvas_height])
  let yAxis = d3.axisRight()
    .scale(yScale)
    .tickValues([15, 20, 25, 30, 35, 40, 45, 50, 55]);
  svg.append("g")
    .call(yAxis)
    .call(g => g.select(".domain").remove())
    .attr("color", "#aaa")

  // 位置整体修正一点点
  svg.attr("transform", "translate(-1, -1)")

}


//===========================================================================
//                              绘制散点图
//===========================================================================
function drawScatter(svg, year, type, use_lite_data) {

  // 获取符合条件的个体的 (x, y) 集合
  let filteredElites = getFilteredElites({type:type, year:year, useLiteData:use_lite_data})
  let data = filteredElites.map((d) => d.getPos(year));

  // 画布长宽
  let width = svg.attr("width")
  let height = svg.attr("height")

  // 映射
  let x = d3.scaleLinear()
    .domain([MAP_LEFT, MAP_RIGHT])
    .range([0, width])
  let y = d3.scaleLinear()
    .domain([MAP_DOWN, MAP_UP])
    .range([0, height])

  // 绘制散点
  svg.append("g")
    .selectAll("g")
    .data(data)
    .join("g")
    .append('circle')
    .attr('cx', d=>x(d[0]))
    .attr('cy', d=>y(d[1]))
    .attr('r', 1)
    .attr("fill", "red")

}


//===========================================================================
//                              绘制箭头
//===========================================================================
function drawArrow(svg, center_x, center_y, radius, angle) {

  // 画布长宽
  let width = svg.attr("width")
  let height = svg.attr("height")

  // 弧度制
  let theta = angle / 360 * 2 * Math.PI

  // 经纬度(x, y) 映射到画布像素 (i,j)
  let xScale = d3.scaleLinear()
    .domain([MAP_LEFT, MAP_RIGHT])
    .range([0, width])
  let yScale = d3.scaleLinear()
    .domain([MAP_DOWN, MAP_UP])
    .range([0, height])

  // 箭头两个端点 point_1 和 point_2 (注意这里是左手系!!!!!)
  let x1 = Number(xScale(center_x - radius * Math.cos(theta)))
  let y1 = Number(yScale(center_y - radius * Math.sin(theta)))
  let x2 = Number(xScale(center_x + radius * Math.cos(theta)))
  let y2 = Number(yScale(center_y + radius * Math.sin(theta)))


  // 开始绘制 (渲染两层以模拟边缘和内部)
  let g = svg.append("g")

  // 绘制箭头
  let head_size = width * 0.015;
  g.append('path')
    .attr('d', generateArrow(x1, y1, x2, y2, head_size))
    .style('fill', 'none')
    .style('stroke', '#aa9cff')
    .style("stroke-width", 4)
  g.append('path')
    .attr('d', generateArrow(x1, y1, x2, y2, head_size - 1))
    .style('fill', 'none')
    .style('stroke', '#fff')
    .style("stroke-width", 1.5)

  // 绘制中心点
  g.append('circle')
    .attr('cx', (x1 + x2) / 2)
    .attr('cy', (y1 + y2) / 2)
    .attr('r', 5)
    .style('fill', '#aa9cff')
  g.append('circle')
    .attr('cx', (x1 + x2) / 2)
    .attr('cy', (y1 + y2) / 2)
    .attr('r', 3.75)
    .style('fill', '#fff')

  // 绘制另一端点
  g.append('circle')
    .attr('cx', x1)
    .attr('cy', y1)
    .attr('r', 5)
    .style('fill', '#aa9cff')
  g.append('circle')
    .attr('cx', x1)
    .attr('cy', y1)
    .attr('r', 3.75)
    .style('fill', '#fff')

  g.attr("id", "arrow")
}


//===========================================================================
//                              散点图开关
//===========================================================================
function drawToggleScatterButton(svg, showing_scatter, toggle_state_func) {
  // 画布长宽
  let width = svg.attr("width")
  let height = svg.attr("height")

  // 绘制矩形
  let g = svg.append("g")
  g.append("rect")
    .attr("fill", "#2b2b2c")
    .attr("stroke", "#5d5dff")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 0.1125 * width)
    .attr("height", 0.035 * height)
    .attr("rx", 5)
    .attr("ry", 5)

  // 文字
  g.append("text")
    .text(showing_scatter ? "隐藏散点图" : "显示散点图")
    .attr("fill", "#fff")
    .attr("font-size", "0.5em")
    .attr("x", height * 0.0065)
    .attr("y", height * 0.025)

  // 设置位置 + 绑定事件
  g.attr("transform", `translate(${width * 0.05}, ${0.05 * height})`)
    .on("click", toggle_state_func)
    .style("cursor", "pointer")
}


//===========================================================================
//                              热力图开关
//===========================================================================
function drawToggleContourButton(svg, showing_contour, toggle_state_func) {
  // 画布长宽
  let width = svg.attr("width")
  let height = svg.attr("height")

  // 绘制矩形
  let g = svg.append("g")
  g.append("rect")
    .attr("fill", "#2b2b2c")
    .attr("stroke", "#5d5dff")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 0.1125 * width)
    .attr("height", 0.035 * height)
    .attr("rx", 5)
    .attr("ry", 5)

  // 文字
  g.append("text")
    .text(showing_contour ? "隐藏密度图" : "显示密度图")
    .attr("fill", "#fff")
    .attr("font-size", "0.5em")
    .attr("x", height * 0.0065)
    .attr("y", height * 0.025)

  // 设置位置 + 绑定事件
  g.attr("transform", `translate(${width * 0.05}, ${0.05 * height + 0.040 * height})`)
    .on("click", toggle_state_func)
    .style("cursor", "pointer")
}



//===========================================================================
//                           CPU / GPU 切换
//===========================================================================
function drawToggleCPUGPU(svg, now_using_gpu, toggle_state_func) {
  // 画布长宽
  let width = svg.attr("width")
  let height = svg.attr("height")

  // 绘制矩形
  let g = svg.append("g")
  g.append("rect")
    .attr("fill", "#2b2b2c")
    .attr("stroke", "#5d5dff")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 0.150 * width)
    .attr("height", 0.035 * height)
    .attr("rx", 5)
    .attr("ry", 5)

  // 文字
  g.append("text")
    .text(now_using_gpu ? "切换为部分数据 (当前: 全部数据 + GPU加速, 卡顿请切换模式)" : "切换为全部数据 (当前: 仅使用 10% 的数据, 提高绘制效率)")
    .attr("fill", "#fff")
    .attr("font-size", "0.5em")
    .attr("x", height * 0.0065)
    .attr("y", height * 0.025)

  // 设置位置 + 绑定事件
  g.attr("transform", `translate(${width * 0.05}, ${0.05 * height + 2 * 0.040 * height})`)
    .on("click", toggle_state_func)
    .style("cursor", "pointer")
}




export {
  drawContour,
  drawScatter,
  drawArrow,
  drawChinaMap,
  drawToggleScatterButton,
  drawToggleContourButton,
  drawToggleCPUGPU
}