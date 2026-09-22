// Utility to help migrate hardcoded Chinese strings to i18n keys
// This is a reference file to track the migration, not used at runtime

export const APP_STRING_MAPPING = {
  // Restore window
  "游戏大厅已收起": "windowRestoreText",
  "恢复窗口": "windowRestoreButton",
  
  // Connection banners
  "连接恢复中，断线后座位保留 30 秒。": "connectionLost",
  "重新登录": "relogin",
  "游客进入": "guestEnter",
  
  // Tabbar
  "◆ 已开放五子棋、中国象棋、斗地主与中国麻将，入座并准备后开始游戏。": "announcement",
  "返回棋桌": "backToTable",
  "房间 / 玩家": "mobileDirectory",
  "游戏切换": "game tabs",
  
  // Hall menu
  "全部游戏": "allGames",
  "五子棋": "gomoku",
  "收藏的游戏桌": "favoriteRooms",
  "休闲大厅": "leisureHall",
  "快速进桌": "quickJoinTable",
  "创建房间": "createRoom",
  "游戏规则": "gameRules",
  
  // Filter bar
  "搜索房间": "searchRoom",
  "房间名 / 编号": "searchPlaceholder",
  "清空搜索": "clearSearch",
  "隐藏满桌": "hideFull",
  " 张游戏桌": "tableCountDisplay",
  "关闭音乐": "disableMusic",
  "开启音乐": "enableMusic",
  "背景音乐已开启": "musicEnabled",
  "背景音乐已关闭": "musicDisabled",
  "关闭音效": "disableSound",
  "开启音效": "enableSound",
  
  // Status footer
  "连接正常": "connected",
  "连接中": "connecting",
  "在线人数：": "onlineCount",
  "游戏桌：": "tableCount",
  "中国麻将 · 大众简化规则": "mahjongRules",
  "斗地主 · 经典叫分": "doudizhuRules",
  "中国象棋 · 娱乐规则": "xiangqiRules",
  "五子棋 · 自由规则": "gomokuRules",
  
  // Error toast
  "关闭": "closeError",
  
  // Create room dialog
  "创建游戏房间": "createRoomTitle",
  "创建游戏桌": "createRoomHeading",
  "创建后可复制邀请链接，好友进入后即可入座。": "createRoomDescription",
  "房间名称": "roomName",
  "输入房间名称": "roomNamePlaceholder",
  "游戏": "game",
  "五子棋 · 双人自由规则": "gomokuDouble",
  "中国象棋 · 双人对弈": "xiangqiDouble",
  "中国麻将 · 四人大众规则": "mahjongFour",
  "斗地主 · 三人经典叫分": "doudizhuThree",
  
  // Help dialog
  "游戏帮助": "helpTitle",
  "游戏操作说明": "helpHeading",
  "进入房间": "helpStep1Title",
  "点击大厅里的棋桌，或创建自己的房间。": "helpStep1Desc",
  "选择席位并准备": "helpStep2Title",
  "选择黑棋或白棋的座位，复制邀请链接给朋友。双方点击「准备开始」就会开局。": "helpStep2Desc",
  "胜负规则": "helpStep3Title",
  "黑棋先行，轮流落子。横、竖、斜任意方向连续五子或更多获胜，本版不设禁手。": "helpStep3Desc",
  "先和电脑练习一局": "practiceWithComputer",
  
  // About dialog
  "游戏设置与信息": "aboutTitle",
  "众乐游戏大厅": "aboutHeading",
  "独立棋牌游戏平台，与任何商业联众或 Lianzhong 平台无关联。": "aboutDescription",
  "账号与战绩保存": "feature1",
  "实时房间和大厅聊天": "feature2",
  "五子棋、象棋、斗地主与麻将联机、练习": "feature3",
  "四款经典棋牌已开放": "feature4",
  "v0.1 · 本地开发版": "versionNote",
  "账号和战绩保留，服务重启会清空房间与进行中的棋局。": "versionDetail",
  "回到大厅": "backToLobby2",
  "退出账号": "logout",
  
  // Practice titles
  "斗地主 · 单机练习": "practiceDoudizhu",
  "中国象棋 · 单机练习": "practiceXiangqi",
  "中国麻将 · 单机练习": "practiceMahjong",
} as const;
