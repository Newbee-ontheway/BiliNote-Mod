# 使用 node:20 (LTS) 的 Debian 版本，提供完整的 glibc 环境
# Tailwind v4 和 Tauri CLI 需要 glibc，Alpine 不兼容
FROM node:20 AS builder

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 拷贝前端源码
COPY ./BillNote_frontend /app

# 安装依赖并执行构建
# 明确安装依赖，如果失败会显示具体原因
RUN pnpm install

# 执行构建，使用 --debug 或类似方式如果支持的话，这里先保持默认
RUN pnpm run build

# --- 阶段2：使用 nginx 作为静态服务器 ---
FROM nginx:1.25-alpine

# 删除默认配置（可选）
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY ./BillNote_frontend/deploy/default.conf /etc/nginx/conf.d/default.conf


# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html