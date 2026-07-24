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

    const authCode = searchParams.get("code");

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
          toast.success("Welcome back!", {
            description: `Logged in successfully as ${user.fullName || user.username}`,
          });
          navigate("/");
        })
        .catch((err) => {
          const message = err.response?.data?.message;
          const errorCode = err.response?.data?.errorCode;

          if (errorCode === "ACCOUNT_LOCKED") {
            navigate("/login?error=locked");
          } else if (message) {
            toast.error("Đăng nhập thất bại", { description: message });
            navigate("/login");
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
      text="Đang đăng nhập với Facebook..."
    />
  );
};

export default FacebookCallbackPage;
