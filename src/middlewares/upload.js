const multer = require('multer');
const path = require('path');

// 메모리 스토리지 사용 (base64 변환을 위해)
const storage = multer.memoryStorage();

// 파일 필터 - 이미지만 허용
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('지원하지 않는 파일 형식입니다. JPEG, PNG, WebP만 허용됩니다.'), false);
    }
};

// 업로드 설정
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB 제한
    }
});

module.exports = upload;
