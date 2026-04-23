import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import authApi from "@/features/auth/api/authApi";

import { login } from "@/features";
import { toast } from "sonner";
import { useAppDispatch } from "@/store/hooks";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";

const GoogleCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const accessToken = searchParams.get("token");

    if (accessToken) {
      authApi
        .getMe(accessToken)
        .then((res) => {
          // ✅ SỬA Ở ĐÂY: Dữ liệu user nằm trong res.data
          const user = res.data;
          dispatch(
            login({
              accessToken,
              user: user, // Truyền user object vào đây
            }),
          );
          toast.success("Welcome back!", {
            description: `Logged in successfully as ${
              user.fullName || user.username
            }`,
          });
          navigate("/");
        })
        .catch((err) => {
          const errorCode = err.response?.data?.errorCode;
          if (errorCode === "ACCOUNT_LOCKED") {
            // Chuyển về login với cờ locked
            navigate("/login?error=locked");
          } else {
            navigate("/login?error=auth_failed");
          }
        });
    } else {
      navigate("/login");
    }
  }, [searchParams, dispatch, navigate]);

  return (
    <WaveformLoader
      glass={false}
      fullscreen
      text="Đang đăng nhập với Google..."
    />
  );
};

export default GoogleCallbackPage;
