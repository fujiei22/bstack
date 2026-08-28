# React + Babel 原型規範

用 HTML + React + Babel 做原型時必須遵守的技術規範。不遵守會炸。

## Pinned Script Tags（必須用這些版本）

在 HTML 的 `<head>` 裡放這三個 script tag，用**固定版本 ＋ integrity hash**：

```html
<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>
```

**不要**用 `react@18` 或 `react@latest` 這種 unpinned 版本——會出現版本漂移／快取問題。

**不要**省略 `integrity`——CDN 一旦被劫持或竄改，這是唯一防線。**這三個 sha384 值抄這裡的，自己生不出來。**

## 檔案結構

```
專案名/
├── index.html               # 主 HTML
├── components.jsx           # 元件檔（type="text/babel" 載入）
├── data.js                  # 資料檔
└── styles.css               # 額外 CSS（可選）
```

HTML 裡的載入方式：

```html
<!-- 先 React + Babel -->
<script src="https://unpkg.com/react@18.3.1/..."></script>
<script src="https://unpkg.com/react-dom@18.3.1/..."></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/..."></script>

<!-- 然後你的元件檔 -->
<script type="text/babel" src="components.jsx"></script>
<script type="text/babel" src="pages.jsx"></script>

<!-- 最後主入口 -->
<script type="text/babel">
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
</script>
```

**不要**用 `type="module"`——會和 Babel 衝突。

## 三條不可違反的規矩

### 規矩 1：styles 物件必須用唯一命名

**錯誤**（多元件時必炸）：
```jsx
// components.jsx
const styles = { button: {...}, card: {...} };

// pages.jsx  ← 同名覆蓋！
const styles = { container: {...}, header: {...} };
```

**正確**：每個元件檔的 styles 用唯一前綴。

```jsx
// terminal.jsx
const terminalStyles = {
  screen: {...},
  line: {...}
};

// sidebar.jsx
const sidebarStyles = {
  container: {...},
  item: {...}
};
```

**或者用 inline styles**（小元件推薦）：
```jsx
<div style={{ padding: 16, background: '#111' }}>...</div>
```

這條是**沒得商量**的。每次寫 `const styles = {...}` 都必須換成有辨識度的命名，否則多元件載入時整頁報錯。

### 規矩 2：Scope 不共享，要手動 export

**關鍵認知**：每個 `<script type="text/babel">` 被 Babel 獨立編譯，它們之間**scope 不通**。`components.jsx` 裡定義的 `Terminal` 元件，在 `pages.jsx` 裡**預設是 undefined**。

**解法**：在每個元件檔末尾，把要共享的元件／工具 export 到 `window`：

```jsx
// components.jsx 末尾
function Terminal(props) { ... }
function Line(props) { ... }
const colors = { green: '#...', red: '#...' };

Object.assign(window, {
  Terminal, Line, colors,
  // 所有你要在別處用的都列在這裡
});
```

然後 `pages.jsx` 就能直接用 `<Terminal />`，因為 JSX 會去 `window.Terminal` 找。

### 規矩 3：不要用 scrollIntoView

`scrollIntoView` 會把整個 HTML 容器往上推，搞壞**容器捲動**的版面。**永遠不要用**。

替代方案：
```js
// 捲到容器內某個位置
container.scrollTop = targetElement.offsetTop;

// 或者用 element.scrollTo
container.scrollTo({
  top: targetElement.offsetTop - 100,
  behavior: 'smooth'
});
```

## 原型裡要「呼叫 LLM」怎麼辦

三方向 mockup 是**設計視覺**，不是可運作的產品。原型若需要 LLM 互動的畫面（例如做一個聊天介面），走下面兩條路，**都不需要任何金鑰**：

### 做法 A：不真的呼叫，用 mock

Demo 場景首選。寫一個假的 helper，回傳預設的 response：

```jsx
window.claude = {
  async complete(prompt) {
    await new Promise(r => setTimeout(r, 800)); // 模擬延遲
    return "這是一個 mock 回應。真的要上線時再換成後端轉發。";
  }
};
```

### 做法 B：先用手上的 agent 生好 mock 資料，再寫死進 HTML

在目前這個 agent 對話裡先產生幾組像樣的 mock 回應，硬寫進 HTML。這樣 HTML 執行時**完全不依賴任何外部 API**，也不會有 CORS 問題。

**不要**在 mockup 裡放任何呼叫真實 API 的程式碼：那需要金鑰，而金鑰會留在 DOM 與記憶體裡，而且這份 HTML 會被截圖、被 review、被別人打開。真正要串接是實作階段的事，一律走後端轉發，瀏覽器端不碰金鑰。

## 典型 HTML 起手樣板

複製這個樣板當 React 原型的骨架：

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Prototype Name</title>

  <!-- React + Babel pinned -->
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; width: 100%; }
    body {
      font-family: -apple-system, 'SF Pro Text', sans-serif;
      background: #FAFAFA;
      color: #1A1A1A;
    }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>

  <!-- 你的元件檔 -->
  <script type="text/babel" src="components.jsx"></script>

  <!-- 主入口 -->
  <script type="text/babel">
    const { useState, useEffect } = React;

    function App() {
      return (
        <div style={{padding: 40}}>
          <h1>Hello</h1>
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>
```

## 常見報錯與解法

**`styles is not defined` 或 `Cannot read property 'button' of undefined`**
→ 你在一個檔裡定義了 `const styles`，另一個檔覆蓋了。每個都改成有辨識度的命名。

**`Terminal is not defined`**
→ 跨檔引用時 scope 不通。在定義 Terminal 的檔末尾加 `Object.assign(window, {Terminal})`。

**整頁白屏、主控台沒有錯誤**
→ 多半是 JSX 語法錯誤但 Babel 沒把它報到主控台。把 `babel.min.js` 暫時換成未壓縮版，錯誤訊息會清楚很多。

**`ReactDOM.createRoot is not a function`**
→ 版本不對。確認用的是 react-dom@18.3.1（而不是 17 或其他）。

**`Objects are not valid as a React child`**
→ 你渲染了一個物件而不是 JSX／字串。通常是 `{someObj}` 該寫成 `{someObj.name}`。

## 檔案大了怎麼拆

**超過 1000 行的單檔**難維護。分拆思路：

```
專案/
├── index.html
├── src/
│   ├── primitives.jsx      # 基礎元素：Button、Card、Badge...
│   ├── components.jsx      # 業務元件：UserCard、PostList...
│   ├── pages/
│   │   ├── home.jsx        # 首頁
│   │   ├── detail.jsx      # 詳情頁
│   │   └── settings.jsx    # 設定頁
│   ├── router.jsx          # 簡單路由（React state 切換）
│   └── app.jsx             # 入口元件
└── data.js                 # mock data
```

HTML 裡按順序載入：
```html
<script type="text/babel" src="src/primitives.jsx"></script>
<script type="text/babel" src="src/components.jsx"></script>
<script type="text/babel" src="src/pages/home.jsx"></script>
<script type="text/babel" src="src/pages/detail.jsx"></script>
<script type="text/babel" src="src/pages/settings.jsx"></script>
<script type="text/babel" src="src/router.jsx"></script>
<script type="text/babel" src="src/app.jsx"></script>
```

**每個檔的末尾**都要 `Object.assign(window, {...})` 導出要共享的東西。
