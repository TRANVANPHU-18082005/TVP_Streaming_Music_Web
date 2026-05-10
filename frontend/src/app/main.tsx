import { createRoot } from "react-dom/client";
import { store } from "@/store/store";
import { injectStore } from "@/lib/axios"; // <--- Đổi hàm này
import React from "react";
import "@/index.css";
import { AppWithRouter } from "@/app/provider";
// ✅ Inject toàn bộ Store vào Axios (Cung cấp cả dispatch và getState)
injectStore(store);

createRoot(document.getElementById("root")!).render(
   
    <AppWithRouter />
  
);
