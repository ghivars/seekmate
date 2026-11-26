"use client";

import { OptionGroup } from "@/components/ui/field";
import { ATMOSPHERES, LANGUAGES, STUDY_GOALS, STYLES, TIMES, type Preferences } from "@/lib/labels";

export type PartialPreferences = Partial<Preferences>;
type Key = keyof Preferences;

interface Props {
  fields: Key[];
  value: PartialPreferences;
  onChange: (value: PartialPreferences) => void;
}

export function isComplete(value: PartialPreferences): value is Preferences {
  return Boolean(
    value.study_goal && value.atmosphere && value.preferred_time && value.communication_style && value.language,
  );
}

export function PreferencesFields({ fields, value, onChange }: Props) {
  const has = (key: Key) => fields.includes(key);
  return (
    <div className="space-y-6">
      {has("study_goal") && (
        <OptionGroup
          legend="Kamu lagi cari apa?"
          options={STUDY_GOALS}
          value={value.study_goal}
          onChange={(study_goal) => onChange({ ...value, study_goal })}
        />
      )}
      {has("atmosphere") && (
        <OptionGroup
          legend="Suasana yang kamu suka"
          options={ATMOSPHERES}
          value={value.atmosphere}
          onChange={(atmosphere) => onChange({ ...value, atmosphere })}
        />
      )}
      {has("preferred_time") && (
        <OptionGroup
          legend="Waktu belajar"
          options={TIMES}
          value={value.preferred_time}
          onChange={(preferred_time) => onChange({ ...value, preferred_time })}
        />
      )}
      {has("communication_style") && (
        <OptionGroup
          legend="Gaya komunikasi"
          options={STYLES}
          value={value.communication_style}
          onChange={(communication_style) => onChange({ ...value, communication_style })}
        />
      )}
      {has("language") && (
        <OptionGroup
          legend="Bahasa ngobrol"
          options={LANGUAGES}
          value={value.language}
          onChange={(language) => onChange({ ...value, language })}
        />
      )}
    </div>
  );
}
