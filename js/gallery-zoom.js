/* 相册页图片查看器（Viewer.js）
 * 背景：flatpaper 主题只给文章页和 layout:page 的页面自动加载 Fancybox，
 * 相册页（layout: 记录生活）不在范围内，这里按需手动加载。
 * 效果：深色蒙层 + 大图居中 + 底部工具栏（缩放/1:1/重置/旋转/全屏），
 * 即 poetize 同款 Viewer.js 灯箱样式。
 * 守卫逻辑：页面上没有 .gallery-grid 就直接退出，其他页面零开销。
 */
(function () {
  var grid = document.querySelector('.gallery-grid');
  if (!grid) return;

  var BASE = 'https://cdn.jsdelivr.net/npm/viewerjs@1.11.7/dist/';

  /* 动态插入 Viewer.js CSS */
  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = BASE + 'viewer.min.css';
  document.head.appendChild(css);

  /* 动态加载 Viewer.js，加载完成后绑定整个相册网格 */
  var js = document.createElement('script');
  js.src = BASE + 'viewer.min.js';
  js.onload = function () {
    if (typeof window.Viewer === 'undefined') return;

    new Viewer(grid, {
      inline: false,          // 点击照片弹出全屏查看层
      button: true,           // 右上角关闭按钮
      navbar: false,          // 不显示底部缩略图条
      title: false,           // 不显示图片标题
      backdrop: true,         // 深色蒙层
      fullscreen: true,       // 支持 ESC 退出、双击放大
      transition: true,
      movable: true,          // 可拖动大图
      zoomable: true,         // 滚轮缩放
      rotatable: true,
      scalable: false,        // 不需要镜像翻转
      zIndex: 9999,
      toolbar: {
        zoomIn: true,         // 放大
        zoomOut: true,        // 缩小
        oneToOne: true,       // 1:1 原始尺寸
        reset: true,          // 重置
        prev: true,           // 上一张
        play: true,           // 自动播放
        next: true,           // 下一张
        rotateLeft: true,     // 左旋转
        rotateRight: true,    // 右旋转
        flipHorizontal: false,
        flipVertical: false
      }
    });
  };
  document.head.appendChild(js);
})();
