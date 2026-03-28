import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";

import type { AuthState } from "@/features/auth/types";
import authApi from "@/features/auth/api/authApi";
import { UserProfile } from "@/features/user";
import { LoginInput } from "../schemas/auth.schema";

// =================================================================
// 1. Initial State
// =================================================================
const initialState: AuthState<UserProfile> = {
  token: null,
  user: null,
  isAuthChecking: true,
};

// =================================================================
// 2. Async Thunks
// =================================================================

// A. Init Auth (Chạy khi F5 App)
export const initAuth = createAsyncThunk(
  "auth/initAuth",
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.refreshAuth();
      // 🛑 DEBUG: In ra xem server trả về cái gì

      const { accessToken, user } = response.data;
      return { accessToken, user };
    } catch (error: unknown) {
      return rejectWithValue(error || "Session expired");
    }
  },
);

// B. Fetch Current User (Chạy khi update profile xong) - MỚI THÊM
export const fetchCurrentUser = createAsyncThunk(
  "auth/fetchCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      // Gọi API lấy thông tin mới nhất của bản thân
      const response = await authApi.getMe();
      return response.data; // Trả về UserProfile mới
    } catch (error: unknown) {
      return rejectWithValue(error);
    }
  },
);

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (data: LoginInput, { rejectWithValue }) => {
    try {
      const res = await authApi.login(data);
      return res.data; // { accessToken, user }
    } catch (error: unknown) {
      return rejectWithValue(error);
    }
  },
);
// =================================================================
// 3. Slice Logic
// =================================================================
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (
      state,
      action: PayloadAction<{ accessToken: string; user: UserProfile }>,
    ) => {
      state.token = action.payload.accessToken;
      state.user = action.payload.user;
      state.isAuthChecking = false;
    },

    refreshSuccess: (state, action: PayloadAction<{ accessToken: string }>) => {
      state.token = action.payload.accessToken;
    },

    logout: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthChecking = false;
    },

    authCheckFinished: (state) => {
      state.isAuthChecking = false;
    },
  },

  // =================================================================
  // 4. Extra Reducers (Xử lý Async)
  // =================================================================
  extraReducers: (builder) => {
    // --- Init Auth ---
    builder
      .addCase(initAuth.pending, (state) => {
        state.isAuthChecking = true;
      })
      .addCase(initAuth.fulfilled, (state, action) => {
        state.token = action.payload.accessToken;
        state.user = action.payload.user;
        state.isAuthChecking = false;
      })
      .addCase(initAuth.rejected, (state) => {
        state.token = null;
        state.user = null;
        state.isAuthChecking = false;
      });

    // --- Fetch Current User (MỚI THÊM) ---
    builder.addCase(fetchCurrentUser.fulfilled, (state, action) => {
      // Chỉ cập nhật thông tin user, giữ nguyên token
      state.user = action.payload;
    });
    // --- Login User ---
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.token = action.payload.accessToken;
      state.user = action.payload.user;
      state.isAuthChecking = false;
    });
  },
});

export const { login, logout, refreshSuccess, authCheckFinished } =
  authSlice.actions;
export default authSlice.reducer;
