const labels: Record<string, [string, string]> = {
  forbidden: ['房间身份已失效，请重新加入。', 'Your room identity expired. Join the room again.'],
  'room-code-unavailable': ['这个房间码正在使用，请换一个。', 'That room code is already in use.'],
  'room-expired': ['房间已过期，请重新创建或加入。', 'This room expired. Create or join another room.'],
  'room-full': ['房间人数已满。', 'This room is full.'],
  'room-not-found': ['没有找到这个房间，请检查房间码。', 'Room not found. Check the room code.'],
  'room-not-connected': ['房间尚未连接，请稍后再试。', 'The room is not connected yet.'],
  'room-create-failed': ['暂时无法创建房间，请稍后再试。', 'The room could not be created. Try again shortly.'],
  'room-join-failed': ['暂时无法加入房间，请稍后再试。', 'The room could not be joined. Try again shortly.'],
  'lan-direct-required': ['没有建立局域网本地直连。请确认两台设备连接同一 Wi-Fi、允许浏览器访问本地网络，并关闭访客网络隔离。', 'A local LAN path could not be established. Use the same Wi-Fi, allow browser access to the local network, and disable guest isolation.'],
  'lan-network-unavailable': ['暂时无法识别当前网络，请关闭 VPN 或隐私代理后重试。', 'The current network could not be identified. Disable VPN or privacy relay and try again.'],
  'lan-network-mismatch': ['这台设备与房间创建者不在同一网络，请连接同一个 Wi-Fi 后再加入。', 'This device is not on the same network as the room host. Join the same Wi-Fi and try again.'],
  'lan-room-upgrade-required': ['这个旧房间已失效，请重新创建局域传送房间。', 'This older room is no longer valid. Create a new LAN Transfer room.'],
  'active-transfer-switch-blocked': ['当前房间仍有传输任务，请暂停或取消后再切换房间。', 'Pause or cancel the active transfer before switching rooms.'],
  'share-api-empty-response': ['连接服务没有返回有效结果。', 'The connection service returned no valid response.'],
  'too-many-room-actions': ['连接请求暂时过多，系统会自动重试。', 'There are temporarily too many connection requests. The app will retry automatically.'],
  'no-recipient-selected': ['请先选择至少一位接收者。', 'Select at least one recipient first.'],
  'peer-not-connected': ['对方设备尚未建立直连，请保持双方页面在线。', 'The other device is not directly connected yet. Keep both pages online.'],
  'peer-channel-closed': ['设备直连已断开，任务会保留供稍后重试。', 'The direct device connection closed. The task remains available to retry.'],
  'source-file-required': ['请重新选择原文件后继续传输。', 'Select the original file again to resume.'],
  'local-file-missing': ['找不到本地原文件，请重新选择。', 'The local source file is missing. Select it again.'],
  'insufficient-local-storage': ['本机可用存储空间不足，无法接收这个文件。', 'This device does not have enough local storage for the file.'],
  'streaming-storage-unavailable': ['当前浏览器不支持大文件流式保存，请换用最新版浏览器。', 'This browser cannot stream large files to local storage. Use a current browser.'],
  'receiver-rejected': ['接收方拒绝了这个文件。', 'The recipient declined this file.'],
  'received-chunk-failed': ['接收数据时出错，可从已完成位置重试。', 'A receive error occurred. Retry from the saved position.'],
  'transfer-failed': ['传输失败，可在传输中心重试。', 'Transfer failed. Retry it in Transfer Center.'],
  'send-files-failed': ['文件未能加入发送队列，请稍后再试。', 'The files could not be queued. Try again shortly.'],
  'receive-failed': ['暂时无法接收这个文件。', 'The file cannot be received right now.'],
};

export const shareErrorText = (code: string | undefined, language: 'zh' | 'en') => {
  if (!code) return '';
  const label = labels[code];
  return label ? label[language === 'zh' ? 0 : 1] : code;
};
