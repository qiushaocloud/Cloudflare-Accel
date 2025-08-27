// 更新日期: 2025-08-25
// 更新内容:
// 1. 无论是否重定向，只要目标是 AWS S3，就自动补全 x-amz-content-sha256 和 x-amz-date
// 2. 改进Docker镜像路径处理逻辑，支持多种格式: 如 hello-world | library/hello-world | docker.io/library/hello-world
// 3. 解决大陆拉取第三方 Docker 镜像层失败的问题，自动递归处理所有 302/307 跳转，无论跳转到哪个域名，都由 Worker 继续反代，避免客户端直接访问被墙 CDN，从而提升拉取成功率
// 4. 感谢老王，处理了暗黑模式下，输入框的颜色显示问题
// 用户配置区域开始 =================================
// 以下变量用于配置代理服务的白名单和安全设置，可根据需求修改。

// ALLOWED_HOSTS: 定义允许代理的域名列表（默认白名单）。
// - 添加新域名：将域名字符串加入数组，如 'docker.io'。
// - 注意：仅支持精确匹配的域名（如 'github.com'），不支持通配符。
// - 只有列出的域名会被处理，未列出的域名将返回 400 错误。
// 示例：const ALLOWED_HOSTS = ['github.com', 'docker.io'];
const ALLOWED_HOSTS = [
  "quay.io",
  "gcr.io",
  "k8s.gcr.io",
  "registry.k8s.io",
  "ghcr.io",
  "docker.cloudsmith.io",
  "registry-1.docker.io",
  "github.com",
  "api.github.com",
  "raw.githubusercontent.com",
  "gist.github.com",
  "gist.githubusercontent.com",
];

// RESTRICT_PATHS: 控制是否限制 GitHub 和 Docker 请求的路径。
// - 设置为 true：只允许 ALLOWED_PATHS 中定义的路径关键字。
// - 设置为 false：允许 ALLOWED_HOSTS 中的所有路径。
// 示例：const RESTRICT_PATHS = true;
const RESTRICT_PATHS = false;

// ALLOWED_PATHS: 定义 GitHub 和 Docker 的允许路径关键字。
// - 添加新关键字：加入数组，如 'user-id-3' 或 'my-repo'。
// - 用于匹配请求路径（如 'library' 用于 Docker Hub 官方镜像）。
// - 路径检查对大小写不敏感，仅当 RESTRICT_PATHS = true 时生效。
// 示例：const ALLOWED_PATHS = ['library', 'my-user', 'my-repo'];
const ALLOWED_PATHS = [
  "library", // Docker Hub 官方镜像仓库的命名空间
  "user-id-1",
  "user-id-2",
];

// 用户配置区域结束 =================================

// 闪电 SVG 图标（Base64 编码）
const LIGHTNING_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
  </svg>`;

// 首页 HTML
const HOMEPAGE_HTML = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare 加速</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(
      LIGHTNING_SVG
    )}">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', sans-serif;
        transition: background-color 0.3s, color 0.3s;
        padding: 1rem;
      }
      .light-mode {
        background: linear-gradient(to bottom right, #f1f5f9, #e2e8f0);
        color: #111827;
      }
      .dark-mode {
        background: linear-gradient(to bottom right, #1f2937, #374151);
        color: #e5e7eb;
      }
      .container {
        width: 100%;
        max-width: 800px;
        padding: 1.5rem;
        border-radius: 0.75rem;
        border: 1px solid #e5e7eb;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
      }
      .light-mode .container {
        background: #ffffff;
      }
      .dark-mode .container {
        background: #1f2937;
      }
      .section-box {
        background: linear-gradient(to bottom, #ffffff, #f3f4f6);
        border-radius: 0.5rem;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
      .dark-mode .section-box {
        background: linear-gradient(to bottom, #374151, #1f2937);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      }
      .theme-toggle {
        position: fixed;
        top: 0.5rem;
        right: 0.5rem;
        padding: 0.5rem;
        font-size: 1.2rem;
      }
      .toast {
        position: fixed;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        background: #10b981;
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        opacity: 0;
        transition: opacity 0.3s;
        font-size: 0.9rem;
        max-width: 90%;
        text-align: center;
      }
      .toast.show {
        opacity: 1;
      }
      .result-text {
        word-break: break-all;
        overflow-wrap: break-word;
        font-size: 0.95rem;
        max-width: 100%;
        padding: 0.5rem;
        border-radius: 0.25rem;
        background: #f3f4f6;
      }
      .dark-mode .result-text {
        background: #2d3748;
      }
  
      /* 强制设置输入框样式 */
      input[type="text"] {
        background-color: white !important;
        color: #111827 !important;
      }
      .dark-mode input[type="text"] {
        background-color: #374151 !important;
        color: #e5e7eb !important;
      }
  
      @media (max-width: 640px) {
        .container {
          padding: 1rem;
        }
        .section-box {
          padding: 1rem;
          margin-bottom: 1rem;
        }
        h1 {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
        }
        h2 {
          font-size: 1.25rem;
          margin-bottom: 0.75rem;
        }
        p {
          font-size: 0.875rem;
        }
        input {
          font-size: 0.875rem;
          padding: 0.5rem;
          min-height: 44px;
        }
        button {
          font-size: 0.875rem;
          padding: 0.5rem 1rem;
          min-height: 44px;
        }
        .flex.gap-2 {
          flex-direction: column;
          gap: 0.5rem;
        }
        .github-buttons, .docker-buttons {
          flex-direction: column;
          gap: 0.5rem;
        }
        .result-text {
          font-size: 0.8rem;
          padding: 0.4rem;
        }
        footer {
          font-size: 0.75rem;
        }
      }
    </style>
  </head>
  <body class="light-mode">
    <button onclick="toggleTheme()" class="theme-toggle bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition">
      <span class="sun">☀️</span>
      <span class="moon hidden">🌙</span>
    </button>
    <div class="container mx-auto">
      <h1 class="text-3xl font-bold text-center mb-8">Cloudflare 加速下载</h1>
  
      <!-- GitHub 链接转换 -->
      <div class="section-box">
        <h2 class="text-xl font-semibold mb-2">⚡ GitHub 文件加速</h2>
        <p class="text-gray-600 dark:text-gray-300 mb-4">输入 GitHub 文件链接，自动转换为加速链接。也可以直接在链接前加上本站域名使用。</p>
        <div class="flex gap-2 mb-2">
          <input
            id="github-url"
            type="text"
            placeholder="请输入 GitHub 文件链接，例如：https://github.com/user/repo/releases/..."
            class="flex-grow p-2 border border-gray-400 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          >
          <button
            onclick="convertGithubUrl()"
            class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
          >
            获取加速链接
          </button>
        </div>
        <p id="github-result" class="mt-2 text-green-600 dark:text-green-400 result-text hidden"></p>
        <div id="github-buttons" class="flex gap-2 mt-2 github-buttons hidden">
          <button onclick="copyGithubUrl()" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition w-full">📋 复制链接</button>
          <button onclick="openGithubUrl()" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition w-full">🔗 打开链接</button>
        </div>
      </div>
  
      <!-- Docker 镜像加速 -->
      <div class="section-box">
        <h2 class="text-xl font-semibold mb-2">🐳 Docker 镜像加速</h2>
        <p class="text-gray-600 dark:text-gray-300 mb-4">输入原镜像地址（如 hello-world 或 ghcr.io/user/repo），获取加速拉取命令。</p>
        <div class="flex gap-2 mb-2">
          <input
            id="docker-image"
            type="text"
            placeholder="请输入镜像地址，例如：hello-world 或 ghcr.io/user/repo"
            class="flex-grow p-2 border border-gray-400 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          >
          <button
            onclick="convertDockerImage()"
            class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
          >
            获取加速命令
          </button>
        </div>
        <p id="docker-result" class="mt-2 text-green-600 dark:text-green-400 result-text hidden"></p>
        <div id="docker-buttons" class="flex gap-2 mt-2 docker-buttons hidden">
          <button onclick="copyDockerCommand()" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition w-full">📋 复制命令</button>
        </div>
      </div>
  
      <footer class="mt-6 text-center text-gray-500 dark:text-gray-400">
        Powered by <a href="https://github.com/fscarmen2/Cloudflare-Accel" class="text-blue-500 hover:underline">fscarmen2/Cloudflare-Accel</a>
      </footer>
    </div>
  
    <div id="toast" class="toast"></div>
  
    <script>
      // 动态获取当前域名
      const currentDomain = window.location.hostname;
  
      // 主题切换
      function toggleTheme() {
        const body = document.body;
        const sun = document.querySelector('.sun');
        const moon = document.querySelector('.moon');
        if (body.classList.contains('light-mode')) {
          body.classList.remove('light-mode');
          body.classList.add('dark-mode');
          sun.classList.add('hidden');
          moon.classList.remove('hidden');
          localStorage.setItem('theme', 'dark');
        } else {
          body.classList.remove('dark-mode');
          body.classList.add('light-mode');
          moon.classList.add('hidden');
          sun.classList.remove('hidden');
          localStorage.setItem('theme', 'light');
        }
      }
  
      // 初始化主题
      if (localStorage.getItem('theme') === 'dark') {
        toggleTheme();
      }
  
      // 显示弹窗提示
      function showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove(isError ? 'bg-green-500' : 'bg-red-500');
        toast.classList.add(isError ? 'bg-red-500' : 'bg-green-500');
        toast.classList.add('show');
        setTimeout(() => {
          toast.classList.remove('show');
        }, 3000);
      }
  
      // 复制文本的通用函数
      function copyToClipboard(text) {
        // 尝试使用 navigator.clipboard API
        if (navigator.clipboard && window.isSecureContext) {
          return navigator.clipboard.writeText(text).catch(err => {
            console.error('Clipboard API failed:', err);
            return false;
          });
        }
        // 后备方案：使用 document.execCommand
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textarea);
          return successful ? Promise.resolve() : Promise.reject(new Error('Copy command failed'));
        } catch (err) {
          document.body.removeChild(textarea);
          return Promise.reject(err);
        }
      }
  
      // GitHub 链接转换
      let githubAcceleratedUrl = '';
      function convertGithubUrl() {
        const input = document.getElementById('github-url').value.trim();
        const result = document.getElementById('github-result');
        const buttons = document.getElementById('github-buttons');
        if (!input) {
          showToast('请输入有效的 GitHub 链接', true);
          result.classList.add('hidden');
          buttons.classList.add('hidden');
          return;
        }
        if (!input.startsWith('https://')) {
          showToast('链接必须以 https:// 开头', true);
          result.classList.add('hidden');
          buttons.classList.add('hidden');
          return;
        }
  
        // 保持现有格式：域名/https://原始链接
        githubAcceleratedUrl = 'https://' + currentDomain + '/https://' + input.substring(8);
        result.textContent = '加速链接: ' + githubAcceleratedUrl;
        result.classList.remove('hidden');
        buttons.classList.remove('hidden');
        copyToClipboard(githubAcceleratedUrl).then(() => {
          showToast('已复制到剪贴板');
        }).catch(err => {
          showToast('复制失败: ' + err.message, true);
        });
      }
  
      function copyGithubUrl() {
        copyToClipboard(githubAcceleratedUrl).then(() => {
          showToast('已手动复制到剪贴板');
        }).catch(err => {
          showToast('手动复制失败: ' + err.message, true);
        });
      }
  
      function openGithubUrl() {
        window.open(githubAcceleratedUrl, '_blank');
      }
  
      // Docker 镜像转换
      let dockerCommand = '';
      function convertDockerImage() {
        const input = document.getElementById('docker-image').value.trim();
        const result = document.getElementById('docker-result');
        const buttons = document.getElementById('docker-buttons');
        if (!input) {
          showToast('请输入有效的镜像地址', true);
          result.classList.add('hidden');
          buttons.classList.add('hidden');
          return;
        }
        dockerCommand = 'docker pull ' + currentDomain + '/' + input;
        result.textContent = '加速命令: ' + dockerCommand;
        result.classList.remove('hidden');
        buttons.classList.remove('hidden');
        copyToClipboard(dockerCommand).then(() => {
          showToast('已复制到剪贴板');
        }).catch(err => {
          showToast('复制失败: ' + err.message, true);
        });
      }
  
      function copyDockerCommand() {
        copyToClipboard(dockerCommand).then(() => {
          showToast('已手动复制到剪贴板');
        }).catch(err => {
          showToast('手动复制失败: ' + err.message, true);
        });
      }
    </script>
  </body>
  </html>
  `;

async function handleToken(realm, service, scope) {
  const tokenUrl = `${realm}?service=${service}&scope=${scope}`;
  console.log(`Fetching token from: ${tokenUrl}`);
  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!tokenResponse.ok) {
      console.log(
        `Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}`
      );
      return null;
    }
    const tokenData = await tokenResponse.json();
    const token = tokenData.token || tokenData.access_token;
    if (!token) {
      console.log("No token found in response");
      return null;
    }
    console.log("Token acquired successfully");
    return token;
  } catch (error) {
    console.log(`Error fetching token: ${error.message}`);
    return null;
  }
}

function isAmazonS3(url) {
  try {
    return new URL(url).hostname.includes("amazonaws.com");
  } catch {
    return false;
  }
}

// 计算请求体的 SHA256 哈希值
async function calculateSHA256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 获取空请求体的 SHA256 哈希值
function getEmptyBodySHA256() {
  return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
}

/**
 * 简单的hash函数
 * @param {string} str 输入字符串
 * @returns {string} hash结果
 */
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为32位整数
  }
  return hash.toString();
};

/**
 * 生成包含过期时间的token
 * @param {string} password 用户密码
 * @returns {string} 生成的token
 */
const generateToken = (password) => {
  // 过期时间：当前时间 + 6小时
  const expires = Date.now() + 6 * 60 * 60 * 1000;
  // 简单的token生成逻辑，实际应用中可以使用更安全的方法
  const tokenContent = {
    p: simpleHash(password),
    e: expires,
  };
  // 转换为base64字符串
  return btoa(JSON.stringify(tokenContent));
};

/**
 * 验证token是否有效
 * @param {string} token 待验证的token
 * @param {string} password 正确密码
 * @returns {boolean} 是否有效
 */
const verifyToken = (token, password) => {
  try {
    const tokenContent = JSON.parse(atob(token));
    // 检查token是否过期
    if (tokenContent.e < Date.now()) {
      return false;
    }
    // 检查密码hash是否匹配
    return tokenContent.p === simpleHash(password);
  } catch (e) {
    return false;
  }
};

/* @returns {boolean} 是否已认证
 */
const isAuthenticated = async (request, env) => {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return false;

  const cookies = cookie.split(";").map((c) => c.trim());
  const authCookie = cookies.find((c) => c.startsWith("cf_auth_token="));

  if (!authCookie) return false;

  const token = authCookie.split("=")[1];
  return verifyToken(token, env.ACCESS_PASSWORD);
};

/**
 * 处理登录请求
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量
 */
const handleLogin = async (request, env) => {
  const url = new URL(request.url);

  // 如果是GET请求，返回登录页面
  if (request.method === "GET") {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>量子安全访问系统</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: "Segoe UI", "Agency FB", sans-serif;
            }

            body {
              background: linear-gradient(135deg, #0c0e1d, #1a1b3d, #2c0b3d);
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              overflow: hidden;
              position: relative;
            }

            /* 科幻背景元素 */
            .grid-lines {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(
                  rgba(25, 130, 180, 0.1) 1px,
                  transparent 1px
                ),
                linear-gradient(90deg, rgba(25, 130, 180, 0.1) 1px, transparent 1px);
              background-size: 30px 30px;
              z-index: 0;
            }

            .glowing-circle {
              position: absolute;
              width: 400px;
              height: 400px;
              border-radius: 50%;
              background: radial-gradient(
                circle,
                rgba(65, 105, 225, 0.4),
                transparent 70%
              );
              top: -150px;
              right: -150px;
              filter: blur(30px);
              animation: pulse 4s infinite alternate;
            }

            .glowing-circle:nth-child(2) {
              width: 300px;
              height: 300px;
              background: radial-gradient(
                circle,
                rgba(138, 43, 226, 0.4),
                transparent 70%
              );
              top: auto;
              bottom: -100px;
              left: -100px;
              animation-delay: -2s;
            }

            /* 登录卡片 */
            .login-card {
              background: rgba(20, 22, 40, 0.6);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(65, 105, 225, 0.4);
              border-radius: 16px;
              padding: 40px 50px;
              width: 90%;
              max-width: 450px;
              z-index: 1;
              position: relative;
              box-shadow: 0 0 30px rgba(65, 105, 225, 0.3),
                0 0 60px rgba(138, 43, 226, 0.1);
              overflow: hidden;
            }

            .login-card::before {
              content: "";
              position: absolute;
              top: -2px;
              left: -2px;
              right: -2px;
              bottom: -2px;
              background: linear-gradient(45deg, #4169e1, #8a2be2, #4169e1, #8a2be2);
              z-index: -1;
              border-radius: 18px;
              animation: border-animate 4s linear infinite;
              background-size: 500% 500%;
            }

            .login-card::after {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: inherit;
              border-radius: 16px;
              z-index: -1;
            }

            .card-header {
              text-align: center;
              margin-bottom: 35px;
            }

            .card-header h1 {
              color: #e0e0ff;
              font-size: 2.2rem;
              letter-spacing: 2px;
              text-transform: uppercase;
              text-shadow: 0 0 10px rgba(65, 105, 225, 0.8);
              margin-bottom: 10px;
              font-weight: 600;
            }

            .card-header p {
              color: #a0a0d0;
              font-size: 1rem;
              letter-spacing: 1px;
            }

            /* 输入框样式 */
            .input-group {
              margin-bottom: 30px;
              position: relative;
            }

            .input-group label {
              display: block;
              color: #a0a0d0;
              margin-bottom: 8px;
              font-size: 0.9rem;
              letter-spacing: 1px;
            }

            .input-field {
              width: 100%;
              background: rgba(10, 12, 30, 0.5);
              border: 1px solid rgba(65, 105, 225, 0.3);
              border-radius: 8px;
              padding: 14px 20px;
              color: #e0e0ff;
              font-size: 1rem;
              letter-spacing: 1px;
              transition: all 0.3s ease;
            }

            .input-field:focus {
              outline: none;
              border-color: #4169e1;
              box-shadow: 0 0 15px rgba(65, 105, 225, 0.5);
            }

            .input-field::placeholder {
              color: #6060a0;
            }

            /* 按钮样式 */
            .submit-btn {
              width: 100%;
              background: linear-gradient(45deg, #4169e1, #8a2be2);
              color: white;
              border: none;
              border-radius: 8px;
              padding: 16px;
              font-size: 1.1rem;
              font-weight: 600;
              letter-spacing: 2px;
              text-transform: uppercase;
              cursor: pointer;
              transition: all 0.3s ease;
              position: relative;
              overflow: hidden;
              box-shadow: 0 5px 20px rgba(65, 105, 225, 0.4);
            }

            .submit-btn::after {
              content: "";
              position: absolute;
              top: -50%;
              left: -50%;
              width: 200%;
              height: 200%;
              background: rgba(255, 255, 255, 0.1);
              transform: rotate(30deg);
              transition: all 0.6s ease;
            }

            .submit-btn:hover {
              transform: translateY(-3px);
              box-shadow: 0 8px 25px rgba(65, 105, 225, 0.6);
            }

            .submit-btn:hover::after {
              transform: rotate(30deg) translate(20%, 20%);
            }

            .submit-btn:active {
              transform: translateY(0);
            }

            /* 科幻元素 */
            .scan-line {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 3px;
              background: linear-gradient(
                90deg,
                transparent,
                #4169e1,
                #8a2be2,
                transparent
              );
              animation: scan 4s linear infinite;
            }

            .terminal-dots {
              position: absolute;
              bottom: 25px;
              left: 30px;
              display: flex;
              gap: 6px;
            }

            .dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #4169e1;
              opacity: 0.7;
              animation: dot-pulse 1.4s infinite ease-in-out;
            }

            .dot:nth-child(2) {
              animation-delay: 0.2s;
            }
            .dot:nth-child(3) {
              animation-delay: 0.4s;
            }

            /* 动画 */
            @keyframes pulse {
              0% {
                opacity: 0.3;
              }
              100% {
                opacity: 0.6;
              }
            }

            @keyframes border-animate {
              0% {
                background-position: 0% 0%;
              }
              100% {
                background-position: 500% 0%;
              }
            }

            @keyframes scan {
              0% {
                transform: translateY(0);
              }
              100% {
                transform: translateY(100vh);
              }
            }

            @keyframes dot-pulse {
              0%,
              100% {
                transform: scale(1);
                opacity: 0.7;
              }
              50% {
                transform: scale(1.3);
                opacity: 1;
              }
            }

            /* 响应式调整 */
            @media (max-width: 500px) {
              .login-card {
                padding: 30px;
              }

              .card-header h1 {
                font-size: 1.8rem;
              }
            }
          </style>
        </head>
        <body>
          <div class="grid-lines"></div>
          <div class="glowing-circle"></div>
          <div class="glowing-circle"></div>

          <div class="login-card">
            <div class="scan-line"></div>

            <div class="card-header">
              <h1>量子安全通道</h1>
              <p>请验证您的访问凭证</p>
            </div>

            <form method="POST">
              <div class="input-group">
                <label for="password">访问密钥</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  class="input-field"
                  placeholder="请输入访问密钥"
                  required
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
              </div>

              <input type="hidden" name="redirect" value="${url.searchParams.get('redirect') || '/' }">

              <button type="submit" class="submit-btn"><span>身份验证</span></button>
            </form>

            <div class="terminal-dots">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          </div>

          <script>
            // 添加简单的粒子效果
            document.addEventListener("DOMContentLoaded", function () {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              canvas.width = window.innerWidth;
              canvas.height = window.innerHeight;
              canvas.style.position = "fixed";
              canvas.style.top = "0";
              canvas.style.left = "0";
              canvas.style.zIndex = "0";
              document.body.appendChild(canvas);

              const particles = [];
              const particleCount = 100;
              const colors = ["#4169e1", "#8a2be2", "#5d42f5", "#3c8ce7"];

              class Particle {
                constructor() {
                  this.x = Math.random() * canvas.width;
                  this.y = Math.random() * canvas.height;
                  this.size = Math.random() * 2 + 0.5;
                  this.speedX = (Math.random() - 0.5) * 0.5;
                  this.speedY = (Math.random() - 0.5) * 0.5;
                  this.color = colors[Math.floor(Math.random() * colors.length)];
                }

                update() {
                  this.x += this.speedX;
                  this.y += this.speedY;

                  if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
                  if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
                }

                draw() {
                  ctx.fillStyle = this.color;
                  ctx.beginPath();
                  ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                  ctx.fill();
                }
              }

              function init() {
                for (let i = 0; i < particleCount; i++) {
                  particles.push(new Particle());
                }
              }

              function animate() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                particles.forEach((particle) => {
                  particle.update();
                  particle.draw();
                });

                requestAnimationFrame(animate);
              }

              init();
              animate();

              // 响应窗口大小变化
              window.addEventListener("resize", function () {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
              });
            });
          </script>
        </body>
      </html>
    `,{
      headers: { "Content-Type": "text/html" },
    });
  }

  // 如果是POST请求，验证密码
  if (request.method === "POST") {
    const formData = await request.formData();
    const passwordI = formData.get("password");
    const redirectI = formData.get("redirect") || "/";

    // 验证密码是否正确（从环境变量获取正确密码）
    if (passwordI === env.ACCESS_PASSWORD) {
      // 设置6小时过期
      const expires = new Date(Date.now() + 6 * 60 * 60 * 1000).toUTCString();
      // return response;
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${url.protocol}//${url.host}${decodeURIComponent(redirectI)}`,
          "Set-Cookie": `cf_auth_token=${generateToken(passwordI)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`,
        },
      });
    } else {
      // 密码错误，返回错误信息
      return new Response("Invalid password", { status: 401 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  let path = url.pathname;
  if (/http(s)?:/.test(path) && !path.includes('//')) {
    path = path.includes('http:') ? path.replace('http:/', 'http://') : path.replace('https:/', 'https://');
  }

  // 记录请求信息
  console.log(`Request: ${request.method} ${path}`);

  if (env.ACCESS_PASSWORD && (url.pathname === "/" || url.pathname === "" || url.pathname === "/cf-login")) {
      if (url.pathname === "/cf-login") return handleLogin(request, env);
      // 检查是否是登录页面或静态资源
      if (!(await isAuthenticated(request, env))) {
        // 未登录且不是公开路由，重定向到登录页面
        return new Response(null, {
          status: 302,
          headers: {
            Location: `${url.protocol}//${url.host}/cf-login?redirect=${encodeURIComponent(url.pathname)}`,
          },
        });
      }
  }
  
  // 首页路由
  if (path === "/" || path === "") {
    return new Response(HOMEPAGE_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  // 处理 Docker V2 API 或 GitHub 代理请求
  let isV2Request = false;
  let v2RequestType = null; // 'manifests' or 'blobs'
  let v2RequestTag = null; // tag or digest
  if (path.startsWith("/v2/")) {
    isV2Request = true;
    path = path.replace("/v2/", "");

    // 解析 V2 API 请求类型和标签/摘要
    const pathSegments = path.split("/").filter((part) => part);
    if (pathSegments.length >= 3) {
      // 格式如: nginx/manifests/latest 或 nginx/blobs/sha256:xxx
      v2RequestType = pathSegments[pathSegments.length - 2];
      v2RequestTag = pathSegments[pathSegments.length - 1];
      // 提取镜像名称部分（去掉 manifests/tag 或 blobs/digest 部分）
      path = pathSegments.slice(0, pathSegments.length - 2).join("/");
    }
  }

  // 提取目标域名和路径
  const pathParts = path.split("/").filter((part) => part);
  if (pathParts.length < 1) {
    return new Response("Invalid request: target domain or path required\n", {
      status: 400,
    });
  }

  let targetDomain,
    targetPath,
    isDockerRequest = false;

  // 检查路径是否以 https:// 或 http:// 开头
  const fullPath = path.startsWith("/") ? path.substring(1) : path;
  if (fullPath.startsWith("https://") || fullPath.startsWith("http://")) {
    // 处理 /https://domain.com/... 或 /http://domain.com/... 格式
    const urlObj = new URL(fullPath);
    targetDomain = urlObj.hostname;
    targetPath = urlObj.pathname.substring(1) + urlObj.search; // 移除开头的斜杠

    // 检查是否为 Docker 请求
    isDockerRequest = [
      "quay.io",
      "gcr.io",
      "k8s.gcr.io",
      "registry.k8s.io",
      "ghcr.io",
      "docker.cloudsmith.io",
      "registry-1.docker.io",
      "docker.io",
    ].includes(targetDomain);

    // 处理 docker.io 域名，转换为 registry-1.docker.io
    if (targetDomain === "docker.io") {
      targetDomain = "registry-1.docker.io";
    }
  } else {
    // 处理 Docker 镜像路径的多种格式
    if (pathParts[0] === "docker.io") {
      // 处理 docker.io/library/nginx 或 docker.io/amilys/embyserver 格式
      isDockerRequest = true;
      targetDomain = "registry-1.docker.io";

      if (pathParts.length === 2) {
        // 处理 docker.io/nginx 格式，添加 library 命名空间
        targetPath = `library/${pathParts[1]}`;
      } else {
        // 处理 docker.io/amilys/embyserver 或 docker.io/library/nginx 格式
        targetPath = pathParts.slice(1).join("/");
      }
    } else if (ALLOWED_HOSTS.includes(pathParts[0])) {
      // Docker 镜像仓库（如 ghcr.io）或 GitHub 域名（如 github.com）
      targetDomain = pathParts[0];
      targetPath = pathParts.slice(1).join("/") + url.search;
      isDockerRequest = [
        "quay.io",
        "gcr.io",
        "k8s.gcr.io",
        "registry.k8s.io",
        "ghcr.io",
        "docker.cloudsmith.io",
        "registry-1.docker.io",
      ].includes(targetDomain);
    } else if (pathParts.length >= 1 && pathParts[0] === "library") {
      // 处理 library/nginx 格式
      isDockerRequest = true;
      targetDomain = "registry-1.docker.io";
      targetPath = pathParts.join("/");
    } else if (pathParts.length >= 2) {
      // 处理 amilys/embyserver 格式（带命名空间但不是 library）
      isDockerRequest = true;
      targetDomain = "registry-1.docker.io";
      targetPath = pathParts.join("/");
    } else {
      // 处理单个镜像名称，如 nginx
      isDockerRequest = true;
      targetDomain = "registry-1.docker.io";
      targetPath = `library/${pathParts.join("/")}`;
    }
  }

  // 默认白名单检查：只允许 ALLOWED_HOSTS 中的域名
  if (!ALLOWED_HOSTS.includes(targetDomain)) {
    console.log(`Blocked: Domain ${targetDomain} not in allowed list`);
    return new Response(`Error: Invalid target domain.\n`, { status: 400 });
  }

  // 路径白名单检查（仅当 RESTRICT_PATHS = true 时）
  if (RESTRICT_PATHS) {
    const checkPath = isDockerRequest ? targetPath : path;
    console.log(`Checking whitelist against path: ${checkPath}`);
    const isPathAllowed = ALLOWED_PATHS.some((pathString) =>
      checkPath.toLowerCase().includes(pathString.toLowerCase())
    );
    if (!isPathAllowed) {
      console.log(`Blocked: Path ${checkPath} not in allowed paths`);
      return new Response(`Error: The path is not in the allowed paths.\n`, {
        status: 403,
      });
    }
  }

  // 构建目标 URL
  let targetUrl;
  if (isDockerRequest) {
    if (isV2Request && v2RequestType && v2RequestTag) {
      // 重构 V2 API URL
      targetUrl = `https://${targetDomain}/v2/${targetPath}/${v2RequestType}/${v2RequestTag}`;
    } else {
      targetUrl = `https://${targetDomain}/${
        isV2Request ? "v2/" : ""
      }${targetPath}`;
    }
  } else {
    targetUrl = `https://${targetDomain}/${targetPath}`;
  }

  const newRequestHeaders = new Headers(request.headers);
  newRequestHeaders.set("Host", targetDomain);
  newRequestHeaders.delete("x-amz-content-sha256");
  newRequestHeaders.delete("x-amz-date");
  newRequestHeaders.delete("x-amz-security-token");
  newRequestHeaders.delete("x-amz-user-agent");

  if (isAmazonS3(targetUrl)) {
    newRequestHeaders.set("x-amz-content-sha256", getEmptyBodySHA256());
    newRequestHeaders.set(
      "x-amz-date",
      new Date().toISOString().replace(/[-:T]/g, "").slice(0, -5) + "Z"
    );
  }

  try {
    // 尝试直接请求（注意：使用 manual 重定向以便我们能拦截到 307 并自己请求 S3）
    let response = await fetch(targetUrl, {
      method: request.method,
      headers: newRequestHeaders,
      body: request.body,
      redirect: "manual",
    });
    console.log(`Initial response: ${response.status} ${response.statusText}`);

    // 处理 Docker 认证挑战
    if (isDockerRequest && response.status === 401) {
      const wwwAuth = response.headers.get("WWW-Authenticate");
      if (wwwAuth) {
        const authMatch = wwwAuth.match(
          /Bearer realm="([^"]+)",service="([^"]*)",scope="([^"]*)"/
        );
        if (authMatch) {
          const [, realm, service, scope] = authMatch;
          console.log(
            `Auth challenge: realm=${realm}, service=${
              service || targetDomain
            }, scope=${scope}`
          );

          const token = await handleToken(
            realm,
            service || targetDomain,
            scope
          );
          if (token) {
            const authHeaders = new Headers(request.headers);
            authHeaders.set("Authorization", `Bearer ${token}`);
            authHeaders.set("Host", targetDomain);
            // 如果目标是 S3，添加必要的 x-amz 头；否则删除可能干扰的头部
            if (isAmazonS3(targetUrl)) {
              authHeaders.set("x-amz-content-sha256", getEmptyBodySHA256());
              authHeaders.set(
                "x-amz-date",
                new Date().toISOString().replace(/[-:T]/g, "").slice(0, -5) +
                  "Z"
              );
            } else {
              authHeaders.delete("x-amz-content-sha256");
              authHeaders.delete("x-amz-date");
              authHeaders.delete("x-amz-security-token");
              authHeaders.delete("x-amz-user-agent");
            }

            const authRequest = new Request(targetUrl, {
              method: request.method,
              headers: authHeaders,
              body: request.body,
              redirect: "manual",
            });
            console.log("Retrying with token");
            response = await fetch(authRequest);
            console.log(
              `Token response: ${response.status} ${response.statusText}`
            );
          } else {
            console.log("No token acquired, falling back to anonymous request");
            const anonHeaders = new Headers(request.headers);
            anonHeaders.delete("Authorization");
            anonHeaders.set("Host", targetDomain);
            // 如果目标是 S3，添加必要的 x-amz 头；否则删除可能干扰的头部
            if (isAmazonS3(targetUrl)) {
              anonHeaders.set("x-amz-content-sha256", getEmptyBodySHA256());
              anonHeaders.set(
                "x-amz-date",
                new Date().toISOString().replace(/[-:T]/g, "").slice(0, -5) +
                  "Z"
              );
            } else {
              anonHeaders.delete("x-amz-content-sha256");
              anonHeaders.delete("x-amz-date");
              anonHeaders.delete("x-amz-security-token");
              anonHeaders.delete("x-amz-user-agent");
            }

            const anonRequest = new Request(targetUrl, {
              method: request.method,
              headers: anonHeaders,
              body: request.body,
              redirect: "manual",
            });
            response = await fetch(anonRequest);
            console.log(
              `Anonymous response: ${response.status} ${response.statusText}`
            );
          }
        } else {
          console.log("Invalid WWW-Authenticate header");
        }
      } else {
        console.log("No WWW-Authenticate header in 401 response");
      }
    }

    // 处理 S3 重定向（Docker 镜像层）
    if (
      isDockerRequest &&
      (response.status === 307 || response.status === 302)
    ) {
      const redirectUrl = response.headers.get("Location");
      if (redirectUrl) {
        console.log(`Redirect detected: ${redirectUrl}`);
        const EMPTY_BODY_SHA256 = getEmptyBodySHA256();
        const redirectHeaders = new Headers(request.headers);
        redirectHeaders.set("Host", new URL(redirectUrl).hostname);

        // 对于任何重定向，都添加必要的AWS头（如果需要）
        if (isAmazonS3(redirectUrl)) {
          redirectHeaders.set("x-amz-content-sha256", EMPTY_BODY_SHA256);
          redirectHeaders.set(
            "x-amz-date",
            new Date().toISOString().replace(/[-:T]/g, "").slice(0, -5) + "Z"
          );
        }

        if (response.headers.get("Authorization")) {
          redirectHeaders.set(
            "Authorization",
            response.headers.get("Authorization")
          );
        }

        const redirectRequest = new Request(redirectUrl, {
          method: request.method,
          headers: redirectHeaders,
          body: request.body,
          redirect: "manual",
        });
        response = await fetch(redirectRequest);
        console.log(
          `Redirect response: ${response.status} ${response.statusText}`
        );

        if (!response.ok) {
          console.log(
            "Redirect request failed, returning original redirect response"
          );
          return new Response(response.body, {
            status: response.status,
            headers: response.headers,
          });
        }
      }
    }

    // 复制响应并添加 CORS 头
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set(
      "Access-Control-Allow-Methods",
      "GET, HEAD, POST, OPTIONS"
    );
    if (isDockerRequest) {
      newResponse.headers.set(
        "Docker-Distribution-API-Version",
        "registry/2.0"
      );
      // 删除可能存在的重定向头，确保所有请求都通过Worker处理
      newResponse.headers.delete("Location");
    }
    return newResponse;
  } catch (error) {
    console.log(`Fetch error: ${error.message}`);
    return new Response(
      `Error fetching from ${targetDomain}: ${error.message}\n`,
      { status: 500 }
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
};
