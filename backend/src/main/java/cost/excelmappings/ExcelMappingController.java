package cost.excelmappings;

import cost.common.ApiResponse;
import cost.common.DataScope;
import java.util.List;
import org.springframework.web.bind.annotation.*;

/** 인증 없이 승인된 대응 API 세 개를 단일 공통 envelope로 노출한다. */
@RestController
public class ExcelMappingController {
    private final ExcelMappingService service;

    public ExcelMappingController(ExcelMappingService service) {
        this.service = service;
    }

    @GetMapping("/api/admin/excel-mappings")
    public ApiResponse<List<ExcelMapping>> getExcelMappings() {
        return ApiResponse.of(service.getExcelMappings(DataScope.ALL));
    }

    @PostMapping("/api/admin/excel-mappings")
    public ApiResponse<ExcelMapping> createExcelMapping(@RequestBody CreateExcelMappingRequest input) {
        return ApiResponse.of(service.createExcelMapping(input));
    }

    @PatchMapping("/api/admin/excel-mappings")
    public ApiResponse<ExcelMapping> updateExcelMapping(
        @RequestParam("excel_label") String label,
        @RequestParam("target_group") String group,
        @RequestParam("target_code") String code,
        @RequestBody UpdateExcelMappingRequest input
    ) {
        return ApiResponse.of(service.updateExcelMapping(label, group, code, input));
    }
}
