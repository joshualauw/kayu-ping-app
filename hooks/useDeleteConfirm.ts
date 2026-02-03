import { useState } from "react";

export const useDeleteConfirm = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [pendingItem, setPendingItem] = useState<any>(null);

  const show = (item: any) => {
    setPendingItem(item);
    setIsVisible(true);
  };

  const hide = () => {
    setIsVisible(false);
    setPendingItem(null);
  };

  const confirm = () => {
    hide();
    return pendingItem;
  };

  return { isVisible, show, hide, confirm, item: pendingItem };
};
