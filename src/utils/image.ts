/**
 * 压缩 base64 图片
 * @param base64Str 原始 base64
 * @param maxWidth 最大宽度
 * @param quality 压缩质量 (0-1)
 */
export const compressImage = (base64Str: string, maxWidth: number = 2000, quality: number = 0.85): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // 保持比例缩放
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            // 转换为 jpeg 格式并压缩质量
            const compressed = canvas.toDataURL('image/jpeg', quality);
            resolve(compressed);
        };
    });
};
