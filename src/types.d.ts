interface Officer {
  id: string;
  name: string;
  role: string;
  major: string;
  whyJoined: string;
  favoriteMemory: string;
  instagram: string;
}

interface AACEvent {
  id: string;
  name: string;
  date: string;
  imageName: string;
  description: string;
  popupStyle: string;
}

interface PopupState {
  id: string;
  styleClass: string;
}