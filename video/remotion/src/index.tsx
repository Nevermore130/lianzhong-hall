import React from "react";
import { Composition, registerRoot } from "remotion";
import { InteractionFilm } from "./InteractionFilm";
import { FPS, FRAMES } from "./story";
const Root = () => (
  <Composition
    id="InteractionPromo"
    component={InteractionFilm}
    durationInFrames={FRAMES}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
registerRoot(Root);
