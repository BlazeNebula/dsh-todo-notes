    // 智能体标记取 Material Design Icons 的 robot-outline。路径静态内联，运行时不联网。
    const ICONS = {
      chevronDown: { box: 512, paths: [{ d: 'M112 184l144 144 144-144', width: 48 }] },
      chevronRight: { box: 512, paths: [{ d: 'M184 112l144 144-144 144', width: 48 }] },
      chevronUp: { box: 512, paths: [{ d: 'M112 328l144-144 144 144', width: 48 }] },
      // 面板类型与元信息图标：清单、文档、时钟。
      list: {
        box: 24,
        paths: [
          { d: 'M8 6h13M8 12h13M8 18h13', width: 2 },
          { d: 'M3 6h.01M3 12h.01M3 18h.01', width: 2 },
        ],
      },
      fileText: {
        box: 24,
        paths: [
          { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', width: 2 },
          { d: 'M14 2v6h6M8 13h8M8 17h8', width: 2 },
        ],
      },
      clock: {
        box: 24,
        paths: [
          { d: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z', width: 2 },
          { d: 'M12 7v5l3 2', width: 2 },
        ],
      },
      // 优先级：旗杆 + 旗面，线性。
      flag: { box: 24, paths: [{ d: 'M6 3v18M6 4h11l-2 4 2 4H6', width: 2 }] },
      check: { box: 512, paths: [{ d: 'M416 128L192 384l-96-96', width: 48 }] },
      folder: {
        box: 512,
        paths: [{
          d: 'M440 432H72a40 40 0 01-40-40V120a40 40 0 0140-40h75.89a40 40 0 0122.19 6.72l27.84 18.56a40 40 0 0022.19 6.72H440a40 40 0 0140 40v240a40 40 0 01-40 40zM32 192h448',
          width: 32,
        }],
      },
      grip: { box: 512, paths: [{ d: 'M96 256h320M96 176h320M96 336h320', width: 32 }] },
      copy: {
        box: 512,
        paths: [
          { d: 'M185 128h279a57 57 0 0157 57v279a57 57 0 01-57 57H185a57 57 0 01-57-57V185a57 57 0 0157-57z', width: 32 },
          { d: 'M383.5 128l.5-24a56.16 56.16 0 00-56-56H112a64.19 64.19 0 00-64 64v216a56.16 56.16 0 0056 56h24', width: 32 },
        ],
      },
      add: { box: 512, paths: [{ d: 'M256 112v288M400 256H112', width: 32 }] },
      // 显示到右侧栏：左列 + 右列的分栏图形。
      panelRight: { box: 24, filled: true, paths: [{ d: 'M3 4H21V20H3V4M5 6V18H10V6H5M12 6V18H19V6H12Z' }] },
      // 切回浮动面板：从右列浮出的小窗图形。
      panelFloat: { box: 24, filled: true, paths: [{ d: 'M3 3H21V21H3V3M5 5V7H19V5H5M5 9V19H19V9H5M7 11H17V17H7V11Z' }] },
      close: { box: 512, paths: [{ d: 'M368 368L144 144M368 144L144 368', width: 32 }] },
      addBatch: {
        box: 512,
        paths: [
          { d: 'M435.13 176H76.87A28.87 28.87 0 0048 204.87v198.26A28.87 28.87 0 0076.87 432h358.26A28.87 28.87 0 00464 403.13V204.87A28.87 28.87 0 00435.13 176z', width: 32 },
          { d: 'M144 80h224', width: 32 },
          { d: 'M112 128h288', width: 32 },
        ],
      },
      folderAdd: {
        box: 512,
        paths: [
          { d: 'M440 432H72a40 40 0 01-40-40V120a40 40 0 0140-40h75.89a40 40 0 0122.19 6.72l27.84 18.56a40 40 0 0022.19 6.72H440a40 40 0 0140 40v240a40 40 0 01-40 40z', width: 32 },
          { d: 'M320 264v96M272 312h96', width: 32 },
        ],
      },
      edit: {
        box: 512,
        paths: [
          { d: 'M384 224v184a40 40 0 01-40 40H104a40 40 0 01-40-40V168a40 40 0 0140-40h167.48', width: 32 },
          { d: 'M459.94 53.25a16.06 16.06 0 00-23.22-.56L424.35 65a8 8 0 000 11.31l11.34 11.32a8 8 0 0011.34 0l12.06-12c6.1-6.09 6.67-16.01.85-22.38zM399.34 90L218.82 270.2a9 9 0 00-2.31 3.93L208.16 299a3.91 3.91 0 004.86 4.86l24.85-8.35a9 9 0 003.93-2.31L422 112.66a9 9 0 000-12.66l-9.95-10a9 9 0 00-12.71 0z', width: 32 },
        ],
      },
      trash: {
        box: 512,
        paths: [
          { d: 'M112 112l20 320c.95 18.49 14.4 32 32 32h184c17.67 0 30.87-13.51 32-32l20-320', width: 32 },
          { d: 'M80 112h352', width: 32 },
          { d: 'M192 112V72a23.93 23.93 0 0124-24h80a23.93 23.93 0 0124 24v40M256 176v224M184 176l8 224M328 176l-8 224', width: 32 },
        ],
      },
      robot: {
        box: 24,
        filled: true,
        paths: [{
          d: 'M17.5 15.5C17.5 16.61 16.61 17.5 15.5 17.5S13.5 16.61 13.5 15.5 14.4 13.5 15.5 13.5 17.5 14.4 17.5 15.5M8.5 13.5C7.4 13.5 6.5 14.4 6.5 15.5S7.4 17.5 8.5 17.5 10.5 16.61 10.5 15.5 9.61 13.5 8.5 13.5M23 15V18C23 18.55 22.55 19 22 19H21V20C21 21.11 20.11 22 19 22H5C3.9 22 3 21.11 3 20V19H2C1.45 19 1 18.55 1 18V15C1 14.45 1.45 14 2 14H3C3 10.13 6.13 7 10 7H11V5.73C10.4 5.39 10 4.74 10 4C10 2.9 10.9 2 12 2S14 2.9 14 4C14 4.74 13.6 5.39 13 5.73V7H14C17.87 7 21 10.13 21 14H22C22.55 14 23 14.45 23 15M21 16H19V14C19 11.24 16.76 9 14 9H10C7.24 9 5 11.24 5 14V16H3V17H5V20H19V17H21V16Z',
        }],
      },
    }

    function icon(name, size) {
      const spec = ICONS[name]
      const px = size === undefined ? 12 : size
      if (spec === undefined) return null
      return h(
        'svg',
        {
          width: px,
          height: px,
          viewBox: '0 0 ' + spec.box + ' ' + spec.box,
          fill: 'none',
          className: 'dtn-icon',
          'aria-hidden': 'true',
        },
        spec.paths.map(function (path, index) {
          return h('path', {
            key: index,
            d: path.d,
            fill: spec.filled === true ? 'currentColor' : 'none',
            stroke: spec.filled === true ? 'none' : 'currentColor',
            strokeWidth: spec.filled === true ? 0 : (path.width || 32),
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          })
        }),
      )
    }

    // ------------------------------------------------------------ 组件