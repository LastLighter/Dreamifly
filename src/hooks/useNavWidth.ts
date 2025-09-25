import { useState, useEffect } from 'react';

export const useNavWidth = () => {
  const [navWidth, setNavWidth] = useState(0);

  useEffect(() => {
    const updateNavWidth = () => {
      const nav = document.getElementById('main-nav');
      if (nav) {
        const width = nav.getBoundingClientRect().width;
        setNavWidth(width);
      }
    };

    // 初始计算
    updateNavWidth();

    // 监听窗口大小变化
    window.addEventListener('resize', updateNavWidth);
    // 监听缩放变化
    window.visualViewport?.addEventListener('resize', updateNavWidth);

    return () => {
      window.removeEventListener('resize', updateNavWidth);
      window.visualViewport?.removeEventListener('resize', updateNavWidth);
    };
  }, []);

  return navWidth;
}; 