export function GomokuStone({ stone }: { stone: 1 | 2 }) {
  return (
    <span
      className={`gomoku-stone stone-${stone === 1 ? "black" : "white"}`}
      aria-hidden="true"
    />
  );
}
