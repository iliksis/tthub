// Kept free of imports (no paraglide) so scripts like prisma/seed.ts can use it.
export const AGE_GROUPS = ["U11", "U13", "U15", "U19", "ADULT"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

// Returns a stable key (not a translated label). Use `ageGroupLabel` to
// display it. `referenceYear` is explicit so callers decide the year: UI code
// passes today's year, statistics code can pass a fixed one.
export const calculateAgeGroup = (
	year: number,
	referenceYear: number,
): AgeGroup => {
	const age = referenceYear - year;

	if (age < 11) return "U11";
	if (age < 13) return "U13";
	if (age < 15) return "U15";
	if (age < 19) return "U19";
	return "ADULT";
};
