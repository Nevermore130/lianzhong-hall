import { cardLabel, type Card } from "../../shared/doudizhu.ts";
const root = "/assets/playing-cards-v2/";
const courtArt: Partial<Record<number, string>> = {
  11: "court-jack",
  12: "court-queen",
  13: "court-king",
};
export function PlayingCard({
  card,
  back = false,
}: {
  card?: Card;
  back?: boolean;
}) {
  const court =
    card === undefined ? undefined : courtArt[Math.floor(card / 4) + 3];
  const joker = card !== undefined && card >= 52;
  const art = joker ? (card === 53 ? "joker-red" : "joker-black") : court;
  return (
    <span
      className={"playing-card" + (back ? " playing-card-back" : "")}
      role="img"
      aria-label={back ? "牌背" : cardLabel(card!)}
    >
      {back ? (
        <img src={root + "card-back.webp"} alt="" draggable={false} />
      ) : (
        <>
          {art && (
            <img
              className={`playing-card-art ${joker ? "joker-art" : "court-art"} ${art}`}
              src={root + art + ".webp"}
              alt=""
              draggable={false}
            />
          )}
          <img
            className="playing-card-indices"
            src={root + "cards/" + card + ".svg"}
            alt=""
            draggable={false}
          />
        </>
      )}
    </span>
  );
}
