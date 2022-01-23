import * as d3 from "d3";
import {generateArrow, kde_1d_gpu, kde_1d_cpu} from "./globals";

//===========================================================================
//                            绘制一维 KDE 图
//===========================================================================
function map1d(svg, bandwidth, data, L, R, color="steelblue", amp, use_gpu) {  // amp: 垂直方向缩放比例

  let width = svg.attr("width");
  let height = svg.attr("height");
  let margin = {
    "left": 0.05 * width,
    "right": 0.05 * width,
    "top": 0.1 * height,
    "bottom": 0.1 * height
  }

  // x 轴方向的比例尺
  const x = d3.scaleLinear()
    .domain([L,R])
    .range([margin.left, width - margin.right])

  // 采样点
  const sample = x.ticks(1000)    // --> [-10, -9.98, -9.96, -9.94,..., 9.98, 10]

  // 计算出所有点对，用于后续画图
  let kde_1d = use_gpu ? kde_1d_gpu : kde_1d_cpu;
  let density = kde_1d(bandwidth, sample, data)

  // x 轴方向的比例尺
  const y = d3.scaleLinear()
    .domain([0,d3.max(density, d => d[1])]).nice()
    .range([height - margin.bottom, margin.top])//y轴方向的比例尺

  const area = d3.area()
    .curve(d3.curveBasis)
    .x(d => x(d[0])).y0(y(0))
    .y1(d=>y(d[1]))

  // 绘制前的缩放
  density = density.map(([x, y]) => [x, amp * y])

  // 绘制密度图
  svg.append("path")
    .datum(density)
    .attr("fill", color)
    .attr("d", area)

  // 箭头两个端点
  let x1 = margin.left
  let y1 = height - margin.bottom
  let x2 = width - margin.right
  let y2 = height - margin.bottom

  // 开始绘制 (渲染两层以模拟边缘和内部)
  let g = svg.append("g")

  // 绘制箭头
  let head_size = width * 0.02;
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
}

export {map1d}