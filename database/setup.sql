-- =============================================
-- AuctionHub 데이터베이스 전체 설정
-- 실행 전: my_app 데이터베이스 생성
-- CREATE DATABASE IF NOT EXISTS my_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE my_app;
-- =============================================

-- 문자셋 설정
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 기존 테이블 문자셋 변경 (이미 테이블이 있는 경우)
ALTER DATABASE my_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 기존 테이블 문자셋 변환
ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE points CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE auction_items CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE bids CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE auction_favorites CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE auto_bids CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE auction_transactions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE auction_notifications CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 포인트 테이블
CREATE TABLE IF NOT EXISTS points (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    amount INT NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 경매 상품 테이블
CREATE TABLE IF NOT EXISTS auction_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    seller_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    category VARCHAR(50),
    start_price INT NOT NULL,
    current_price INT NOT NULL,
    ai_predicted_price INT,
    buy_now_price INT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status ENUM('대기', '진행중', '종료', '유찰') DEFAULT '대기',
    winner_id INT NULL,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 입찰 내역 테이블
CREATE TABLE IF NOT EXISTS bids (
    id INT PRIMARY KEY AUTO_INCREMENT,
    auction_id INT NOT NULL,
    user_id INT NOT NULL,
    bid_price INT NOT NULL,
    bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_auto_bid BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (auction_id) REFERENCES auction_items(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 즐겨찾기 (찜) 테이블
CREATE TABLE IF NOT EXISTS auction_favorites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    auction_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (auction_id) REFERENCES auction_items(id),
    UNIQUE KEY unique_favorite (user_id, auction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 자동 입찰 설정 테이블
CREATE TABLE IF NOT EXISTS auto_bids (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    auction_id INT NOT NULL,
    max_price INT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (auction_id) REFERENCES auction_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 거래 내역 테이블
CREATE TABLE IF NOT EXISTS auction_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    auction_id INT NOT NULL,
    seller_id INT NOT NULL,
    buyer_id INT NOT NULL,
    final_price INT NOT NULL,
    transaction_status ENUM('결제대기', '거래완료', '취소') DEFAULT '결제대기',
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (auction_id) REFERENCES auction_items(id),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (buyer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 경매 알림 테이블
CREATE TABLE IF NOT EXISTS auction_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    auction_id INT NOT NULL,
    type ENUM('outbid', 'ending_soon', 'won', 'lost') NOT NULL,
    message VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (auction_id) REFERENCES auction_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스 생성 (이미 존재하면 무시)
DROP PROCEDURE IF EXISTS create_indexes;
DELIMITER //
CREATE PROCEDURE create_indexes()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'auction_items' AND index_name = 'idx_auction_status') THEN
        CREATE INDEX idx_auction_status ON auction_items(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'auction_items' AND index_name = 'idx_auction_end_time') THEN
        CREATE INDEX idx_auction_end_time ON auction_items(end_time);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'auction_items' AND index_name = 'idx_auction_category') THEN
        CREATE INDEX idx_auction_category ON auction_items(category);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'bids' AND index_name = 'idx_bids_auction') THEN
        CREATE INDEX idx_bids_auction ON bids(auction_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'bids' AND index_name = 'idx_bids_user') THEN
        CREATE INDEX idx_bids_user ON bids(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'points' AND index_name = 'idx_points_user') THEN
        CREATE INDEX idx_points_user ON points(user_id);
    END IF;
END //
DELIMITER ;
CALL create_indexes();
DROP PROCEDURE IF EXISTS create_indexes;

-- =============================================
-- 샘플 데이터 삽입
-- =============================================

-- 테스트 유저 (비밀번호: password123 - bcrypt 해시)
INSERT INTO users (id, email, password, name, nickname) VALUES
(1, 'demo@test.com', '$2b$10$YourHashedPasswordHere', '테스트유저', '입찰왕')
ON DUPLICATE KEY UPDATE email = email;

-- 테스트 유저에게 포인트 지급
INSERT INTO points (user_id, amount, reason) VALUES
(1, 100000, '신규 가입 보너스')
ON DUPLICATE KEY UPDATE amount = amount;

-- 샘플 경매 상품
INSERT INTO auction_items (seller_id, title, description, image_url, category, start_price, current_price, ai_predicted_price, start_time, end_time, status) VALUES
(1, 'iPhone 14 Pro 256GB', '상태 S급, 배터리 95%, 풀박스', NULL, '전자기기', 800000, 800000, 920000, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), '진행중'),
(1, '맥북 프로 M2 14인치', '2023년 구매, 애플케어 남음', NULL, '전자기기', 1500000, 1500000, 1750000, NOW(), DATE_ADD(NOW(), INTERVAL 48 HOUR), '진행중'),
(1, '에어팟 프로 2세대', '미개봉 새제품', NULL, '전자기기', 200000, 200000, 230000, NOW(), DATE_ADD(NOW(), INTERVAL 12 HOUR), '진행중'),
(1, '닌텐도 스위치 OLED', '젤다 에디션, 박스 있음', NULL, '게임', 300000, 300000, 350000, NOW(), DATE_ADD(NOW(), INTERVAL 36 HOUR), '진행중'),
(1, '플레이스테이션 5', '디스크 에디션, 듀얼센스 2개', NULL, '게임', 450000, 450000, 520000, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), '진행중'),
(1, '다이슨 에어랩', '컴플리트 롱, 1회 사용', NULL, '가전', 400000, 400000, 480000, NOW(), DATE_ADD(NOW(), INTERVAL 48 HOUR), '진행중'),
(1, '삼성 갤럭시 워치 6', '44mm 블랙, 정품 스트랩', NULL, '전자기기', 180000, 180000, 210000, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), '진행중'),
(1, '캠핑 텐트 4인용', '코베아 정품, 2회 사용', NULL, '스포츠', 250000, 250000, 290000, NOW(), DATE_ADD(NOW(), INTERVAL 72 HOUR), '진행중'),
(1, '전공책 세트 (컴퓨터공학)', '운영체제, 네트워크, 자료구조', NULL, '도서', 50000, 50000, 60000, NOW(), DATE_ADD(NOW(), INTERVAL 48 HOUR), '진행중'),
(1, '자전거 (삼천리 하이브리드)', '2022년식, 상태 좋음', NULL, '스포츠', 200000, 200000, 240000, NOW(), DATE_ADD(NOW(), INTERVAL 96 HOUR), '진행중')
ON DUPLICATE KEY UPDATE title = VALUES(title);
