export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  Chat: { friendId: string; friendName: string; avatarUrl?: string };
};

export type MainTabParamList = {
  Znajomi: undefined;
  Szukaj: undefined;
  Zaproszenia: undefined;
  Profil: undefined;
};
