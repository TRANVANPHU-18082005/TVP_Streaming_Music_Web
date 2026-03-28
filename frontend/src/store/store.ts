import { configureStore, combineReducers, AnyAction } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";

// Reducers
import authReducer from "@/features/auth/slice/authSlice";
import playerReducer from "@/features/player/slice/playerSlice";
import interactionReducer from "@/features/interaction/slice/interactionSlice"; // Import reducer mới

import { injectStore, setGlobalAccessToken } from "@/lib/axios";

// 1. Cấu hình Persist riêng cho Interaction
const interactionPersistConfig = {
  key: "interaction",
  storage,
  // Chỉ persist danh sách follow artist, không persist bài hát like để tối ưu dung lượng
  whitelist: ["followedArtists"],
};

const playerPersistConfig = {
  key: "player",
  storage,
  blacklist: ["isPlaying", "isLoading", "duration"],
};
export const USER_LOGOUT = "auth/logoutAll";
// 2. Root Reducer

const appReducer = combineReducers({
  auth: authReducer,
  player: persistReducer(playerPersistConfig, playerReducer),
  interaction: persistReducer(interactionPersistConfig, interactionReducer),
});

// 2. Định nghĩa Root Reducer với Type chuẩn
const rootReducer = (
  state: ReturnType<typeof appReducer> | undefined,
  action: AnyAction,
) => {
  // 🚀 Khi nhận lệnh logout
  if (action.type === "auth/logout") {
    // Xóa bộ nhớ vật lý của Redux Persist
    storage.removeItem("persist:player");
    storage.removeItem("persist:interaction");

    // Reset State về trạng thái ban đầu
    state = undefined;
  }

  return appReducer(state, action);
};

// 3. Store Initialization
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: import.meta.env.NODE_ENV !== "production",
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// 4. Side Effects
injectStore(store);

let currentToken = store.getState().auth.token;
if (currentToken) setGlobalAccessToken(currentToken);

store.subscribe(() => {
  const newState = store.getState();
  const newToken = newState.auth.token;
  if (newToken !== currentToken) {
    currentToken = newToken;
    setGlobalAccessToken(currentToken);
  }
});
