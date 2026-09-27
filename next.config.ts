import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 開発サーバーに http://127.0.0.1:3000 でもアクセスできるようにする（開発時のみ有効）
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
