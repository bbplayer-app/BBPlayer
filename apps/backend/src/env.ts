// eslint-disable-next-line import/no-unassigned-import -- 接入 Wrangler 的全局声明，本模块仅通过 import type 引用。
import '../worker-configuration'

// 让导入 AppType 的其他工作区也能解析 Wrangler 生成的环境类型。
export type Env = Cloudflare.Env
