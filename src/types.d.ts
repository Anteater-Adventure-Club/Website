interface Officer {
  id: string;
  name: string;
  role: string;
  major: string;
  whyJoined: string;
  favoriteMemory: string;
  instagram: string;
  imagePath: string;
}

interface AACEvent {
  id: string;
  name: string;
  date: string;
  description: string;
  imagePath: string;
}

type PolaroidType = Officer | AACEvent;
type PolaroidTypeName = "officer" | "event";
