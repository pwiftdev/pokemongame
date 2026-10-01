export function onboardingSteps(step: 1 | 2) {
  return `<nav class="wop-steps" aria-label="Adventure setup"><span ${step === 1 ? 'aria-current="step"' : ""}>01 · Adventurer</span><span ${step === 2 ? 'aria-current="step"' : ""}>02 · Pokémon</span></nav>`;
}
