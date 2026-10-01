import { startup } from "./loading/progress";
import { failLoading, mountLoadingScreen } from "./loading/screen";
mountLoadingScreen();
void startup
  .track("engine", "engine", "game engine", () => import("./main"))
  .catch(failLoading);
