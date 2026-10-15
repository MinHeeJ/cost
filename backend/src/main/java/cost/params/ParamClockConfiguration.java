package cost.params;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 기준값 현재월은 클라이언트 시각이 아닌 서울 서버 Clock으로 결정한다. */
@Configuration
public class ParamClockConfiguration {
    @Bean("paramsClock")
    public Clock paramsClock() {
        return Clock.system(ZoneId.of("Asia/Seoul"));
    }
}
