import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppSelector } from "@/store/hooks"; // Để lấy default values từ Redux Auth
import { profileSchema } from "../schemas/profile.schema";

export const useProfileForm = (onSubmit: (data: FormData) => Promise<void>) => {
  const { user } = useAppSelector((state) => state.auth);

  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.fullName || "",
      bio: user?.bio || "",
      avatar: user?.avatar || "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    const formData = new FormData();
    if (values.name) formData.append("name", values.name);
    if (values.bio) formData.append("bio", values.bio);

    // Nếu avatar là File (user vừa chọn ảnh mới)
    if (values.avatar instanceof File) {
      formData.append("avatar", values.avatar);
    }

    await onSubmit(formData);
  });

  return { form, handleSubmit };
};
