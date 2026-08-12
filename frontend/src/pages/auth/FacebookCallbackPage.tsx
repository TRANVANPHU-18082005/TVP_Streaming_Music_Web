import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import authApi from "@/features/auth/api/authApi";

import { toast } from "sonner";
import { useAppDispatch } from "@/store/hooks";
import { WaveformLoader } from "@/components/ui/MusicLoadingEffects";
import { login } from "@/features/auth";

const FacebookCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    // 1. Kiểm tra nếu URL đã có lỗi từ backend redirect hoặc từ nhà cung cấp
    const errorParam = searchParams.get("error");
    if (errorParam) {
      const reason = searchParams.get("reason") || searchParams.get("error_description") || searchParams.get("error_reason");
      const provider = searchParams.get("provider") || "facebook";
      const queryStr = reason
        ? `?error=${encodeURIComponent(errorParam)}&provider=${encodeURIComponent(provider)}&reason=${encodeURIComponent(reason)}`
        : `?error=${encodeURIComponent(errorParam)}&provider=${encodeURIComponent(provider)}`;
      navigate(`/login${queryStr}`, { replace: true });
      return;
    }

    const authCode = searchParams.get("code");
    console.log("authCode", authCode);
    if (authCode) {
      authApi
        .exchangeSocialCode(authCode)
        .then((res) => {
          const { accessToken, user } = res.data;
          dispatch(
            login({
              accessToken,
              user,
            }),
          );
          toast.success("Đăng nhập thành công!", {
            description: `Chào mừng ${user.fullName || user.username} trở lại TVP Music`,
          });
          const currentLocation = window.location.pathname;
          if (currentLocation.startsWith('/album') || currentLocation.startsWith('/playlist') || currentLocation.startsWith('/artist')) {
            const hashIndex = currentLocation.indexOf('#');
            const pathWithoutHash = hashIndex > -1 ? currentLocation.slice(0, hashIndex) : currentLocation;
            navigate(pathWithoutHash);
          } else {
            navigate("/");
          }
        })
        .catch((err) => {
          const message = err.response?.data?.message || "Trao đổi mã xác thực thất bại";
          const errorCode = err.response?.data?.errorCode || "OAUTH_TOKEN_EXCHANGE_FAILED";
          navigate(
            `/login?error=${encodeURIComponent(errorCode)}&provider=facebook&reason=${encodeURIComponent(message)}`,
            { replace: true }
          );
        });
    } else {
      navigate(
        `/login?error=OAUTH_ERROR&provider=facebook&reason=${encodeURIComponent("Không tìm thấy mã xác thực từ Facebook")}`,
        { replace: true }
      );
    }
  }, [searchParams, dispatch, navigate]);

  return (
    <WaveformLoader
      glass={false}
      fullscreen
      text="Đang đăng nhập với Facebook..."
    />
  );
};

export default FacebookCallbackPage;
