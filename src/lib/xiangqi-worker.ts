import { chooseXiangqiMove, type XiangqiState } from "../../shared/xiangqi.ts";
self.onmessage = (
  event: MessageEvent<{ match: XiangqiState; depth: number }>,
) => {
  self.postMessage(chooseXiangqiMove(event.data.match, event.data.depth));
};
