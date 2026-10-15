package cost.common;

import com.fasterxml.jackson.databind.DeserializationFeature;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 승인 요청 schema에 없는 필드를 조용히 버리지 않고 400 입력 오류로 처리한다. */
@Configuration
public class JsonConfiguration {
    @Bean
    public Jackson2ObjectMapperBuilderCustomizer rejectUnknownProperties() {
        return builder -> builder.featuresToEnable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    }
}
