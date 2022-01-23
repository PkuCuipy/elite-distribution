import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import * as d3 from "d3";
import $ from "jquery";
import {} from "./data";        // 读取数据的模块最先加载
import {
  DEFAULT_ELITE_TYPE,
  DEFAULT_YEAR_SELECTED,
  DEFAULT_KERNEL_WIDTH,
  DEFAULT_ARROW_ANGLE,
  DEFAULT_ARROW_LENGTH,
  FIXED_ARROW_ORIGIN,
  YEAR_MAX,
  YEAR_MIN,
  THEME_COLOR,
  DEFAULT_USE_GPU,
  getProjected1DPos
} from "./globals";
import {getFilteredElites} from "./data";
import {map1d} from "./1d-map";
import {drawBigEvents, drawPeopleAlive} from "./timeline";
import {
  drawArrow,
  drawContour,
  drawScatter,
  drawChinaMap,
  drawToggleScatterButton,
  drawToggleContourButton, drawToggleCPUGPU
} from "./2d-map";



//===========================================================================
//                                  杂项
//===========================================================================

// 水平和垂直均居中的文字
function CenteredText(props) {
  return (
    <div style={{
      textAlign: "center",
      borderRight: props.hideLine ? null : "1.5px solid #555",
      height: "101%",
      display: "grid",
      alignItems: "center",
    }}> {props.children} </div>
  )
}

// 占位符
function PlaceHolder() {
  return <div> </div>
}

//===========================================================================
//                                  标题栏
//===========================================================================
// 大标题
class MainTitle extends React.Component {
  render() {
    return (
      <div
        id="main-title" style={{     // 这里用 Grid 垂直居中排版
        display: "grid",
        gridTemplateColumns: "1fr",
        gridTemplateRows: "1fr",
        alignItems: "center",
      }}>
        <div style={{textAlign:"center", fontSize: "1.3rem"}}>
          中国 {this.props.year} 年社会精英地域分布图
        </div>
      </div>
    )
  }
}

//===========================================================================
//                               精英类别选择
//===========================================================================

// 选择按钮 (对 Button 的封装)
class Choice extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hovered: false,
    }
  }
  render() {
    return (
      <button
        onClick={()=>{
          this.props.onChoiceSelected();
          this.setState({clicked: true})
        }}
        onMouseOver={()=>{this.setState({hovered: true})}}
        onMouseOut={()=>{this.setState({hovered: false})}}
        style={{
          fontSize: "0.9em",
          borderWidth: "0",
          borderRadius: "0.4rem",
          background: this.props.isClicked ? this.props.themeColor : "#aaa",
          cursor: "pointer",
          color: "white",
          width: "80%",
          height: "50%",
          display: "block",
          margin: "0 auto",
          opacity: this.state.hovered ? 0.8 : 1.0,
        }}
      >
        {this.props.choiceName}
      </button>
    )
  }
}

// 精英类别选择 (三个选项: 进士 / 郡望 / 官职)
class EliteTypeSetting extends React.Component {
  render() {
    return (
      <div id="elite-type-setting" style={{
            display: "grid",
            gridTemplateColumns: "10fr 2fr 30fr 2fr",
            gridTemplateRows: "100%",
            alignItems: "center",
            textAlign: "center",
      }}>
        <CenteredText> 精英类别 </CenteredText>
        <PlaceHolder/>
        <div style={{
          height: "100%",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gridTemplateRows: "100%",
          alignItems: "center",
        }}>
          {["进士", "郡望", "官职"].map((c) =>
            <Choice
              choiceName={c}
              key={c}
              themeColor={THEME_COLOR[c]}
              onChoiceSelected={()=>{this.props.onEliteTypeChange(c)}}
              isClicked={c === this.props.eliteType} />
          )}
        </div>
        <PlaceHolder/>
      </div>
    )
  }
}


//===========================================================================
//                               绘制选项
//===========================================================================

// 拖动条 (对 Input.range 的封装)
class RangeBar extends React.Component {
  render() {
    return (
      <div style={{
        height: "100%",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "18fr 40fr 3fr",
        gridTemplateRows: "100%",
        alignItems: "center",
      }}>
        <div> {this.props.name} </div>
        <input
          type="range"
          min={this.props.min}
          max={this.props.max}
          value={this.props.val}
          step={this.props.step}
          onChange={(e)=>this.props.onValueChange(e.target.value)}
        />
      </div>
    )
  }
}

// 绘图设置 (包含三个拖动条, 分别调整 核函数半径 / 箭头旋转 / 箭头长度)
class MapSetting extends React.Component {
  render() {
    return (
      <div id="map-setting" style={{
        display: "grid",
        gridTemplateColumns: "10fr 34fr",
        gridTemplateRows: "100%",
        alignItems: "center",
        textAlign: "center",
      }}>
        <CenteredText> 绘制选项 </CenteredText>
        <div style={{
          height: "100%",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "100%",
          gridTemplateRows: "1fr 1fr 1fr",
          alignItems: "center",
        }}>
          <RangeBar
            name="平滑程度"
            min={0.1}
            max={2}
            step={0.1}
            val={this.props.kernelWidth}
            onValueChange={this.props.onKernelWidthChange}
          />
          <RangeBar
            name="箭头旋转"
            min={0}
            max={360}
            step={0.1}
            val={this.props.arrowAngle}
            onValueChange={this.props.onArrowAngleChange}
          />
          <RangeBar
            name="箭头长度"
            min={1}
            max={20}
            step={0.1}
            val={this.props.arrowLength}
            onValueChange={this.props.onArrowLengthChange}
          />
        </div>
      </div>
    )
  }
}

//===========================================================================
//             1D 视图  (横轴是箭头对应的地理范围, 纵轴是人口相对密度)
//===========================================================================

class Map1D extends React.Component {

  componentDidMount() {
    let canvas_height = $("#map-1d").outerHeight()       // 计算宽高
    let canvas_width = canvas_height * (27 / 20);
    let svg = d3.select("#map-1d")                  // 新建 svg
      .append("svg")
      .attr("width", canvas_width)
      .attr("height", canvas_height)

    // KDE 的 bandwidth
    let bandwidth = this.props.kernelWidth * 0.51    // 这里的系数是手工随便调的

    // 生成 [全部] 精英的数据, 并绘制数据密度图
    let all_elite_pos_2d = getFilteredElites({
      year: this.props.year,
      useLiteData:!this.props.useGPU})
      .map(d => d.getPos(this.props.year))
    let data_all = getProjected1DPos(all_elite_pos_2d, this.props.arrowLength, this.props.arrowAngle)
    map1d(svg,  bandwidth, data_all, -this.props.arrowLength, this.props.arrowLength, "#ad1906", 1.0)

    // 生成 [选中类别的] 精英的数据, 并绘制数据密度图
    let selected_elite_pos_2d = getFilteredElites({
      type: this.props.eliteType,
      year: this.props.year,
      useLiteData:!this.props.useGPU
    }).map(d => d.getPos(this.props.year))
    let data_select = getProjected1DPos(selected_elite_pos_2d, this.props.arrowLength, this.props.arrowAngle)
    let propotion = data_select.length / data_all.length;
    map1d(svg,  bandwidth, data_select, -this.props.arrowLength, this.props.arrowLength, THEME_COLOR[this.props.eliteType], propotion)
  }

  componentDidUpdate() {
    let map1D = $("#map-1d")[0]
    map1D.removeChild(map1D.lastChild)       // 摧毁旧的 SVG
    this.componentDidMount();                // 重新绘图
  }

  render() {
    return (
      <div id="map-1d" />       // 渲染一个空 div, 由 D3.js 绘制具体内容
    )
  }
}

//===========================================================================
//               2D 视图  (以地图为背景, 人口分布的 Contour 图)
//===========================================================================

class Map2D extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      showScatter: false,
      showContour: true
    }
  }

  componentDidMount() {

    // 0. 创建 svg 画布
    let svg_height = $("#map-2d").outerHeight()
    let svg_width = svg_height * (33 / 28);
    let svg = d3.select("#map-2d")
      .append("svg")
      .attr("width", svg_width)
      .attr("height", svg_height)

    // 1. 绘制 Contour 图
    this.state.showContour &&  drawContour(svg, this.props.year, undefined, this.props.kernelWidth, 100, this.props.useGPU);

    // 2. 绘制地图
    drawChinaMap(svg);

    // 3. 绘制散点图
    this.state.showScatter && drawScatter(svg, this.props.year, undefined, !this.props.useGPU)

    // 4. 绘制箭头
    drawArrow(svg, ...FIXED_ARROW_ORIGIN, this.props.arrowLength, this.props.arrowAngle)

    // 5. 散点图切换按钮
    drawToggleScatterButton(svg, this.state.showScatter, ()=>{this.setState((state) => ({
        showScatter: !state.showScatter
      })
    )});

    // 6. 热力图切换按钮
    drawToggleContourButton(svg, this.state.showContour, ()=>{this.setState((state) => ({
      showContour: !state.showContour
      })
    )});

    // 7. GPU / CPU 切换按钮
    drawToggleCPUGPU(svg, this.props.useGPU, this.props.onCPUGPUToggle);
  }

  componentDidUpdate() {
    let map2D = $("#map-2d")[0]
    map2D.removeChild(map2D.lastChild)       // 摧毁旧的 SVG
    this.componentDidMount();                // 重新绘图
  }

  render() {
    return (
      <div id="map-2d" />   // 渲染一个空 div, 由 D3.js 绘制具体内容
    )
  }
}

//===========================================================================
//               时间轴模块  (人数统计, 朝代时间标识, 年份交互选择)
//===========================================================================

// 出生人数统计图
class PeopleAlivePlot extends React.Component {

  shouldComponentUpdate(nextProps, nextState, nextContext) {
    return (this.props.appSize.H !== nextProps.appSize.H)   // 除非窗口大小变动, 否则不必重绘
  }

  componentDidMount() {
    let canvas = $("#people-alive-plot")
    let canvas_height = canvas.outerHeight()
    let canvas_width = canvas.outerWidth()
    let svg = d3.select("#people-alive-plot")     // 新建 svg
      .append("svg")
      .attr("width", canvas_width)
      .attr("height", canvas_height)
    let bandwidth = canvas_height * 0.233333      // 随便调的值, 差不多和 2D 图的带宽匹配即可
    let data_alive = getFilteredElites({}).map(d=>d.birth_year)   // 统计每个人的出生年份
    drawPeopleAlive(svg, bandwidth, data_alive, YEAR_MIN, YEAR_MAX, "#3b347a")      // 绘制 1d 图
  }

  componentDidUpdate() {
    let alivePlot = $("#people-alive-plot")[0]
    alivePlot.removeChild(alivePlot.lastChild)        // 摧毁旧的 SVG
    this.componentDidMount();                         // 重新绘图
  }

  render() {
    return (
      <div id="people-alive-plot" />        // 渲染一个空 div, 由 D3.js 绘制具体内容
    )
  }
}

// 重要事件展示
class BigEvents extends React.Component {

  shouldComponentUpdate(nextProps, nextState, nextContext) {
    return (this.props.appSize.H !== nextProps.appSize.H)
  }

  componentDidMount() {
    let canvas = $("#big-events-plot")
    let canvas_height = canvas.outerHeight()
    let canvas_width = canvas.outerWidth()
    let svg = d3.select("#big-events-plot")
      .append("svg")
      .attr("width", canvas_width)
      .attr("height", canvas_height)
    drawBigEvents(svg)
  }

  componentDidUpdate() {
    let eventsPlot = $("#big-events-plot")[0]
    eventsPlot.removeChild(eventsPlot.lastChild)      // 摧毁旧的 SVG
    this.componentDidMount();                         // 重新绘图
  }

  render() {
    return (
      <div id="big-events-plot" />        // 渲染一个空 div, 由 D3.js 绘制具体内容
    )
  }
}

// 年份拖动条
class YearBar extends React.Component {
  render() {
    return (
      <div style={{
        height: "100%",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "10fr",
        gridTemplateRows: "100%",
        alignItems: "center",
      }}>
        <input
          type="range"
          step="1"
          min={this.props.min}
          max={this.props.max}
          value={this.props.val}
          onChange={(e)=>this.props.onValueChange(e.target.value)}
        />
      </div>
    )
  }
}

// 时间轴模块
class Timeline extends React.Component {
  render() {
    return (
      <div id="timeline" style={{
        display: "grid",
        gridTemplateColumns: "1fr 11fr",
        gridTemplateRows: "100%",
        alignItems: "center",
        textAlign: "center",
      }}>
        <CenteredText> 时间轴 </CenteredText>
        <div style={{
          height: "100%",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 8fr",
          gridTemplateRows: "1fr 1fr 1fr",
          alignItems: "center",
        }}>

          <CenteredText hideLine={true}> 统计人数 </CenteredText>
          <PeopleAlivePlot appSize={this.props.appSize}/>

          <CenteredText hideLine={true}> 时间节点 </CenteredText>
          <BigEvents appSize={this.props.appSize}/>

          <CenteredText hideLine={true}> 年份选择 </CenteredText>
          <YearBar
            min={YEAR_MIN}
            max={YEAR_MAX}
            val={this.props.year}
            onValueChange={this.props.onYearSelectedChange}
          />

        </div>
      </div>
    )
  }
}


//===========================================================================
//                                  主应用
//===========================================================================
class App extends React.Component {

  constructor(props) {
    super(props);
    // 计算 #root 的宽高 (使其在保持 3:2 的比例下尽可能填充屏幕)
    const PADDING_RATIO = 0.03;
    let H = window.innerHeight;
    let W = window.innerWidth;
    let root_h, root_w;
    if (H * 1.5 > W) {   // 方屏
      root_w = W;
      root_h = W / 1.5;
    } else {              // 带鱼屏
      root_w = H * 1.5;
      root_h = H;
    }
    // 设置 #root 的宽高和 Padding, 并保证 #root 的 *Content* 的比例是 3:2
    document.getElementById("root").style.width = String(root_w) + "px";
    document.getElementById("root").style.height = String(root_h) + "px";
    document.getElementById("root").style.padding = `${root_h * PADDING_RATIO}px ${root_w * PADDING_RATIO}px`;

    // 自己维护的各种状态
    this.state = {
      year_selected: DEFAULT_YEAR_SELECTED,   // 618 ~ 1911
      kernel_width: DEFAULT_KERNEL_WIDTH,
      arrow_length: DEFAULT_ARROW_LENGTH,
      arrow_angle: DEFAULT_ARROW_ANGLE,       // 0 ~ 360
      elite_type: DEFAULT_ELITE_TYPE,
      app_size: {                   // 窗口像素长宽, 子组件 排版 / 绘图 / 判断是否更新 时可能会用
        H: root_h,
        W: root_w,
      },
      use_gpu: DEFAULT_USE_GPU       // 默认使用 CPU or GPU
    }
    // 设置字体大小 (正比于窗口大小)
    $("html").css("font-size", root_h * 0.03)
  }

  // 处理自己的所有 state 的 change 事件
  handleEliteTypeChange = (new_type) => {
    this.setState({
      elite_type: new_type
    })
  }
  handleArrowLengthChange = (new_len) => {
    this.setState({
      arrow_length: new_len
    })
  }
  handleArrowAngleChange = (new_ang) => {
    this.setState({
      arrow_angle: new_ang
    })
  }
  handleKernelWidthChange = (new_width) => {
    this.setState({
      kernel_width: new_width
    })
  }
  handleYearSelectedChange = (new_year) => {
    this.setState({
      year_selected: new_year
    })
  }
  handleToggleCPUGPU = () => {
    this.setState((prevState) => {
      console.log("toggle CPU / GPU")
      return {
          use_gpu: !prevState.use_gpu
        }
    })
  }

  // 渲染 container, 包含所有子组件
  render() {
    return (
      <div id="app-container">
        <MainTitle
          appSize={this.state.app_size}
          year={this.state.year_selected}
        />
        <Map1D
          appSize={this.state.app_size}
          year={this.state.year_selected}
          arrowAngle={this.state.arrow_angle}
          arrowLength={this.state.arrow_length}
          eliteType={this.state.elite_type}
          kernelWidth={this.state.kernel_width}
          useGPU={this.state.use_gpu}
        />
        <Map2D
          appSize={this.state.app_size}
          year={this.state.year_selected}
          arrowAngle={this.state.arrow_angle}
          arrowLength={this.state.arrow_length}
          kernelWidth={this.state.kernel_width}
          useGPU={this.state.use_gpu}
          onCPUGPUToggle={this.handleToggleCPUGPU}
        />
        <EliteTypeSetting
          appSize={this.state.app_size}
          onEliteTypeChange={this.handleEliteTypeChange}
          eliteType={this.state.elite_type}
        />
        <MapSetting
          appSize={this.state.app_size}
          arrowAngle={this.state.arrow_angle}
          arrowLength={this.state.arrow_length}
          kernelWidth={this.state.kernel_width}
          onKernelWidthChange={this.handleKernelWidthChange}
          onArrowAngleChange={this.handleArrowAngleChange}
          onArrowLengthChange={this.handleArrowLengthChange}
        />
        <Timeline
          appSize={this.state.app_size}
          onYearSelectedChange={this.handleYearSelectedChange}
          year={this.state.year_selected}
        />
      </div>
    )
  }
}


// ========================================

ReactDOM.render(
  <App />,
  document.getElementById('root')
);
