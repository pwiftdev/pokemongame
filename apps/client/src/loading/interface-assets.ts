import { CLASSES } from "../../../../packages/shared/classes";
import { SPECIES_MODELS, EVOLVED_MODELS } from "../roster";
import { startup } from "./progress";
export async function prepareInterface() {
  const names = new Set([
    ...Object.values(SPECIES_MODELS),
    ...Object.values(EVOLVED_MODELS),
    ...Object.values(CLASSES).map((entry) => entry.model),
  ]);
  const images = [...names].map((name) => ({
    url: `/assets/portraits/${name}.png`,
    name: `${name.replaceAll("_", " ")} portrait`,
  }));
  images.push({ url: "/assets/ui/world-mark.svg", name: "World emblem" });
  images.push(
    ...["BaseColor", "Normal"].map((kind) => ({
      url: `/assets/village/T_Brick_${kind}.png`,
      name: kind === "Normal" ? "Path details" : "Village paths",
    })),
  );
  const results = await Promise.allSettled([
    ...images.map(({ url, name }) =>
      startup.track(url, "interface", name, async () => {
        const image = new Image();
        image.src = url;
        await image.decode();
      }),
    ),
    ...[
      ['500 15px "Chakra Petch"', "Interface lettering"],
      ['600 15px "Chakra Petch"', "Interface emphasis"],
      ['700 17px "Chakra Petch"', "Button lettering"],
      ['700 30px "Pixelify Sans"', "Adventure titles"],
      ['400 12px "Silkscreen"', "Labels & hotkeys"],
      ['700 12px "Silkscreen"', "Highlighted labels"],
    ].map(([font, label]) =>
      startup.track(`font:${font}`, "interface", label, async () => {
        await document.fonts.load(font);
      }),
    ),
  ]);
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}
