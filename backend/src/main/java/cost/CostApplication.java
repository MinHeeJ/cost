package cost;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** 공개 기반 읽기 서비스의 MVC, MyBatis, Flyway 구성 진입점. */
@SpringBootApplication
public class CostApplication {
    public static void main(String[] args) {
        SpringApplication.run(CostApplication.class, args);
    }
}
