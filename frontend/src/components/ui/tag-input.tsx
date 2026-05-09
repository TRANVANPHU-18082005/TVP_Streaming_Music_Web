import React, { useState, useRef } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagInputProps {
  placeholder?: string;
  value?: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  className?: string;
  disabled?: boolean;
}

export const TagInput: React.FC<TagInputProps> = ({
  placeholder = "Nhập tag...",
  value = [],
  onChange,
  maxTags = 10,
  className,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS ---

  // Focus vào input khi click vào container
  const handleContainerClick = () => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    // Validate: Có nội dung, chưa tồn tại, chưa quá giới hạn
    if (trimmed && !value.includes(trimmed) && value.length < maxTags) {
      onChange([...value, trimmed]);
      setInputValue("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    if (disabled) return;
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      // Xóa tag cuối cùng khi input rỗng và nhấn Backspace
      e.preventDefault();
      const newTags = [...value];
      newTags.pop();
      onChange(newTags);
    }
  };

  const handleBlur = () => {
    // Tự động thêm tag nếu người dùng click ra ngoài mà chưa Enter
    if (inputValue) {
      addTag(inputValue);
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={cn(
        // Layout & Borders giống hệt Shadcn Input
        "flex w-full flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "min-h-10", // Chiều cao tối thiểu chuẩn 40px

        // Focus State (Dùng focus-within thay vì state JS)
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",

        // Disabled State
        disabled && "cursor-not-allowed opacity-50",

        className,
      )}
    >
      {/* Render Tags */}
      {value.map((tag, index) => (
        <Badge
          key={index}
          variant="secondary"
          className="rounded-sm px-1.5 py-0.5 font-normal text-sm gap-1 hover:bg-secondary/80 animate-in fade-in zoom-in duration-200"
        >
          {tag}
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation(); // Ngăn focus ngược lại input
              removeTag(tag);
            }}
            className="rounded-full outline-none hover:bg-background/20 focus:ring-2 focus:ring-ring focus:ring-offset-0"
          >
            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            <span className="sr-only">Remove {tag}</span>
          </button>
        </Badge>
      ))}

      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        className={cn(
          "flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-[120px]",
          "disabled:cursor-not-allowed",
        )}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={
          value.length >= maxTags
            ? "Đã đạt giới hạn"
            : value.length === 0
              ? placeholder
              : ""
        }
        disabled={disabled || value.length >= maxTags}
      />
    </div>
  );
};
