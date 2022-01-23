import * as d3 from "d3";
import {YEAR_MIN, YEAR_MAX, EVENTS, kde_1d_gpu} from "./globals";


//===========================================================================
//                           绘制大事件的时间段
//===========================================================================
function drawBigEvents(svg) {

  let width = svg.attr("width");
  let height = svg.attr("height");
  let margin = {
    "left": 0.005 * width,
    "right": 0.005 * width,
    "top": 0.05 * height,
    "bottom": 0.2 * height
  }

  // 计算每个朝代的持续时间
  for (let i = 0; i < EVENTS.length - 1; i++) {
    EVENTS[i].push(EVENTS[i+1][0] - EVENTS[i][0])
  }

  // 年份映射到像素
  let xScale = d3.scaleLinear()
    .domain([YEAR_MIN, YEAR_MAX])
    .range([margin.left, width - margin.right])

  // 绘制矩形
  let gs = svg.append("g")
    .selectAll("g")
    .data(EVENTS.slice(0, -1))    // 最后一个不画
    .join("g")

  gs.append("rect")
    .attr("x", d => xScale(d[0]))
    .attr("width", d => (xScale(d[2]) - xScale(0)) - width * 0.005)
    .attr("y", height / 4)
    .attr("height", height / 2)
    .attr("fill", "#d2c4ff")
    .attr("stroke", "#9e83ff")
    .attr("stroke-width", 0.5)

  // 鼠标悬浮提示
  gs.append("title")
    .text(d => `${d[1]}: ${d[0]}~${d[0] + d[2]}`)

  gs.append("text")
    .text((d) => d[1][0])     // 只显示一个字
    .attr("x", d => xScale(d[0] + d[2] / 2) - height * 0.29)
    .attr("y", height * 0.685)
}


//===========================================================================
//                     统计数据中, 每个年份的出生人数
//===========================================================================
function drawPeopleAlive(svg, bandwidth, data, L, R, color) {

  let width = svg.attr("width");
  let height = svg.attr("height");
  let margin = {
    "left": 0.005 * width,
    "right": 0.005 * width,
    "top": 0.05 * height,
    "bottom": 0.3 * height
  }

  // x 轴方向的比例尺
  const x = d3.scaleLinear()
    .domain([L,R])
    .range([margin.left, width - margin.right])

  // 1000 个采样点
  const sample = x.ticks(1000)

  // 计算出所有点对，用于后续画图
  let density = kde_1d_gpu(bandwidth, sample, data)

  // x 轴方向的比例尺
  const y = d3.scaleLinear()
    .domain([0,d3.max(density, d => d[1])]).nice()
    .range([height - margin.bottom, margin.top])//y轴方向的比例尺

  const area = d3.area()
    .curve(d3.curveBasis)
    .x(d => x(d[0])).y0(y(0))
    .y1(d=>y(d[1]))

  // 绘制 x 轴
  const xAxis = g => g
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisTop(x))
    .call(g => g.selectAll("text").remove())  // 去掉文字
    .call(g => g.selectAll("line").remove())  // 去掉刻度

  svg.append("g")
    .call(xAxis)

  // 绘制密度图
  svg.append("path")
    .datum(density)
    .attr("fill", color)
    .attr("d", area)
}


export {
  drawBigEvents,
  drawPeopleAlive
}