import { Config } from "@remotion/cli/config";
import path from "node:path";
import { videoWebpack } from "./scripts/webpack";
Config.setPublicDir(path.resolve(".generated/public"));
Config.overrideWebpack(videoWebpack);
