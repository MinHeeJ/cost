package cost.menus;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import cost.common.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminMenuController.class)
@Import({AdminMenuService.class, AdminMenuAdapter.class, CurrentUser.class, PermissionService.class,
    RequestIdFilter.class, ApiExceptionHandler.class, JsonConfiguration.class})
class AdminMenuApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean AdminMenuMapper mapper;
    List<AdminMenuRow> rows;

    @BeforeEach
    void setup() {
        rows = new ArrayList<>(List.of(
            row(1, null, null, 2, "Y"), row(2, null, null, 1, "N"),
            row(11, 1L, "UI-25", 2, "Y"), row(12, 1L, "UI-33", 1, "N"),
            row(13, 1L, "UI-12", 3, "Y"), row(14, 1L, "UI-16", 4, "Y")
        ));
        when(mapper.selectAll()).thenAnswer(call -> new ArrayList<>(rows));
        when(mapper.update(any())).thenAnswer(call -> {
            AdminMenuRow changed = call.getArgument(0);
            rows.replaceAll(old -> old.getMenuId().equals(changed.getMenuId()) ? changed : old);
            return 1;
        });
        when(mapper.insert(any())).thenAnswer(call -> {
            AdminMenuRow added = call.getArgument(0);
            added.setMenuId(9007199254740993L);
            rows.add(added);
            return 1;
        });
    }

    private AdminMenuRow row(long id, Long parent, String screen, int order, String use) {
        AdminMenuRow row = new AdminMenuRow();
        row.setMenuId(id);
        row.setParentMenuId(parent);
        row.setScreenId(screen);
        row.setIcon(parent == null ? "grid" : null);
        row.setMenuName("메뉴 " + id);
        row.setSortOrder(order);
        row.setUseYn(use);
        row.setMobileYn("Y");
        row.setUpdatedAt(LocalDateTime.of(2026, 10, 1, 0, 0));
        return row;
    }

    private ArrayNode body() throws Exception {
        String response = mvc.perform(get("/api/admin/menus")).andReturn().getResponse().getContentAsString();
        ArrayNode source = (ArrayNode) json.readTree(response).get("data");
        return writeNodes(source);
    }

    private ArrayNode writeNodes(ArrayNode source) {
        ArrayNode result = json.createArrayNode();
        source.forEach(item -> {
            ObjectNode node = ((ObjectNode) item).deepCopy();
            node.remove(List.of("screen_id", "icon", "updated_at", "updated_by"));
            node.set("children", writeNodes((ArrayNode) item.get("children")));
            result.add(node);
        });
        return result;
    }

    private void reject(ArrayNode request, int status, String field) throws Exception {
        String before = json.writeValueAsString(rows);
        clearInvocations(mapper);
        var result = mvc.perform(put("/api/admin/menus").contentType("application/json")
                .content(json.writeValueAsString(request)))
            .andExpect(status().is(status))
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andReturn();
        var error = json.readTree(result.getResponse().getContentAsString());
        assertThat(error.get("requestId").asText()).isEqualTo(result.getResponse().getHeader("X-Request-Id"));
        if (field != null) {
            assertThat(error.get("field").asText()).isEqualTo(field);
        } else {
            assertThat(error.get("code").asText()).isEqualTo("MENU_REQUIRED");
        }
        verify(mapper, never()).update(any());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).insertScreenPermissions(any());
        assertThat(json.writeValueAsString(rows)).isEqualTo(before);
    }

    @Test
    void anonymousReadIncludesInactiveAndEmptyGroupsWithoutWriting() throws Exception {
        String before = json.writeValueAsString(rows);
        mvc.perform(get("/api/admin/menus"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data[0].menu_id").value("2"))
            .andExpect(jsonPath("$.data[0].children").isEmpty())
            .andExpect(jsonPath("$.data[1].children[0].use_yn").value("N"))
            .andExpect(jsonPath("$.data[1].children[0].parent_menu_id").value("1"))
            .andExpect(jsonPath("$.data[1].updated_at").isString())
            .andExpect(jsonPath("$.data[1].updated_by").isEmpty());
        verify(mapper).selectAll();
        verifyNoMoreInteractions(mapper);
        assertThat(json.writeValueAsString(rows)).isEqualTo(before);
    }

    @Test
    void emptyAdminTreeIsSuccessful() throws Exception {
        rows.clear();
        mvc.perform(get("/api/admin/menus"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    void anonymousCreateUsesGeneratedKeyAndLeavesExistingRowsAndPermissionsUnchanged() throws Exception {
        String before = json.writeValueAsString(rows);
        mvc.perform(post("/api/admin/menus/groups").contentType("application/json")
                .content("{\"menu_name\":\"새 묶음\",\"icon\":\"folder\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.menu_id").value("9007199254740993"))
            .andExpect(jsonPath("$.data.parent_menu_id").isEmpty())
            .andExpect(jsonPath("$.data.screen_id").isEmpty())
            .andExpect(jsonPath("$.data.children").isEmpty())
            .andExpect(jsonPath("$.data.sort_order").value(3))
            .andExpect(jsonPath("$.data.use_yn").value("Y"))
            .andExpect(jsonPath("$.data.mobile_yn").value("Y"))
            .andExpect(jsonPath("$.data.updated_by").isEmpty());
        assertThat(json.writeValueAsString(rows.subList(0, 6))).isEqualTo(before);
        verify(mapper, never()).insertScreenPermissions(any());
        verify(mapper, never()).update(any());
    }

    @Test
    void groupCanBeCreatedOnEmptyDatabase() throws Exception {
        rows.clear();
        mvc.perform(post("/api/admin/menus/groups").contentType("application/json")
                .content("{\"menu_name\":\"첫 묶음\",\"icon\":\"grid\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.sort_order").value(1));
        assertThat(rows).hasSize(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"grid", "db", "folder", "calendar", "receipt", "chart", "wallet",
        "lock", "sparkle", "gear"})
    void allTenApprovedIconsAreAccepted(String icon) throws Exception {
        mvc.perform(post("/api/admin/menus/groups").contentType("application/json")
                .content("{\"menu_name\":\"묶음\",\"icon\":\"" + icon + "\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.icon").value(icon));
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing", "empty", "long", "icon", "unknown", "malformed"})
    void invalidCreateNeverWrites(String kind) throws Exception {
        ObjectNode request = json.createObjectNode().put("menu_name", "묶음").put("icon", "grid");
        switch (kind) {
            case "missing" -> request.remove("menu_name");
            case "empty" -> request.put("menu_name", "");
            case "long" -> request.put("menu_name", "가".repeat(51));
            case "icon" -> request.put("icon", "menu");
            case "unknown" -> request.put("screen_id", "UI-99");
            default -> { }
        }
        mvc.perform(post("/api/admin/menus/groups").contentType("application/json")
                .content(kind.equals("malformed") ? "{" : request.toString()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").isString());
        verify(mapper, never()).insert(any());
        assertThat(rows).hasSize(6);
    }

    @Test
    void anonymousSaveRenumbersReordersAndPersistsFlagsWithNullActor() throws Exception {
        ArrayNode request = body();
        ObjectNode group = (ObjectNode) request.get(1);
        ArrayNode children = (ArrayNode) group.get("children");
        ((ObjectNode) children.get(0)).put("use_yn", "Y").put("menu_name", "변경 메뉴");
        ((ObjectNode) children.get(2)).put("mobile_yn", "N");
        var first = children.remove(0);
        children.add(first);
        group.put("sort_order", 99);
        mvc.perform(put("/api/admin/menus").contentType("application/json").content(request.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[1].sort_order").value(2))
            .andExpect(jsonPath("$.data[1].children[0].screen_id").value("UI-25"))
            .andExpect(jsonPath("$.data[1].children[0].sort_order").value(1))
            .andExpect(jsonPath("$.data[1].children[1].mobile_yn").value("N"))
            .andExpect(jsonPath("$.data[1].children[3].menu_name").value("변경 메뉴"));
        mvc.perform(get("/api/admin/menus"))
            .andExpect(jsonPath("$.data[1].children[3].menu_name").value("변경 메뉴"));
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.getUpdatedBy()).isNull();
            assertThat(row.getUpdatedAt()).isAfter(LocalDateTime.of(2026, 10, 1, 0, 0));
        });
        verify(mapper, times(6)).update(any());
        verify(mapper, never()).insertScreenPermissions(any());
        verify(mapper, never()).insert(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing", "unknown", "duplicate", "emptyName", "longName", "parent",
        "cycle", "thirdLevel", "promote", "missingParent", "flag", "unknownProperty", "order", "children"})
    void invalidWholeTreeDoesNotUpdateAnyRow(String kind) throws Exception {
        ArrayNode request = body();
        ObjectNode root = (ObjectNode) request.get(1);
        ArrayNode children = (ArrayNode) root.get("children");
        ObjectNode leaf = (ObjectNode) children.get(0);
        String field = "menu_id";
        switch (kind) {
            case "missing" -> children.remove(0);
            case "unknown" -> leaf.put("menu_id", "999");
            case "duplicate" -> children.add(leaf.deepCopy());
            case "emptyName" -> { leaf.put("menu_name", ""); field = "menu_name"; }
            case "longName" -> { leaf.put("menu_name", "가".repeat(51)); field = "menu_name"; }
            case "parent" -> { leaf.put("parent_menu_id", "11"); field = "parent_menu_id"; }
            case "cycle" -> { root.put("parent_menu_id", "1"); field = "parent_menu_id"; }
            case "thirdLevel" -> { ((ArrayNode) leaf.get("children")).add(leaf.deepCopy()); field = "children"; }
            case "promote" -> {
                children.remove(0); leaf.putNull("parent_menu_id"); request.add(leaf); field = "parent_menu_id";
            }
            case "missingParent" -> { root.remove("parent_menu_id"); field = "parent_menu_id"; }
            case "flag" -> { leaf.put("use_yn", "X"); field = "use_yn"; }
            case "unknownProperty" -> { leaf.put("screen_id", "UI-99"); field = "screen_id"; }
            case "order" -> { leaf.put("sort_order", 0); field = "sort_order"; }
            case "children" -> { leaf.remove("children"); field = "children"; }
            default -> throw new IllegalStateException(kind);
        }
        reject(request, 400, field);
    }

    @ParameterizedTest
    @ValueSource(strings = {"UI-16", "UI-25"})
    void disablingRequiredScreenIsConflict(String screen) throws Exception {
        ArrayNode request = body();
        ObjectNode group = (ObjectNode) request.get(1);
        int index = screen.equals("UI-25") ? 1 : 3;
        ((ObjectNode) group.get("children").get(index)).put("use_yn", "N");
        reject(request, 409, null);
    }

    @Test
    void disablingRequiredParentIsConflict() throws Exception {
        ArrayNode request = body();
        ((ObjectNode) request.get(1)).put("use_yn", "N");
        reject(request, 409, null);
    }

    @Test
    void movingRequiredScreenToInactiveNewParentIsConflict() throws Exception {
        ArrayNode request = body();
        ObjectNode old = (ObjectNode) request.get(1);
        ObjectNode target = (ObjectNode) request.get(0);
        ObjectNode moved = (ObjectNode) ((ArrayNode) old.get("children")).remove(1);
        moved.put("parent_menu_id", "2");
        ((ArrayNode) target.get("children")).add(moved);
        reject(request, 409, null);
    }

    @Test
    void movingRequiredScreenToActiveNewParentPreservesIdentityAndIcon() throws Exception {
        ArrayNode request = body();
        ObjectNode old = (ObjectNode) request.get(1);
        ObjectNode target = (ObjectNode) request.get(0);
        target.put("use_yn", "Y");
        ObjectNode moved = (ObjectNode) ((ArrayNode) old.get("children")).remove(1);
        moved.put("parent_menu_id", "2");
        ((ArrayNode) target.get("children")).add(moved);
        mvc.perform(put("/api/admin/menus").contentType("application/json").content(request.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].icon").value("grid"))
            .andExpect(jsonPath("$.data[0].children[0].screen_id").value("UI-25"))
            .andExpect(jsonPath("$.data[0].children[0].parent_menu_id").value("2"));
    }

    @Test
    void internalScreenInsertUsesGeneratedKeyForPermissions() {
        AdminMenuService service = new AdminMenuService(new AdminMenuAdapter(mapper),
            new CurrentUser(), new PermissionService());
        AdminMenuNode created = service.insertScreen(1L, "UI-99", "내부 화면");
        assertThat(created.getMenuId()).isEqualTo("9007199254740993");
        var sequence = inOrder(mapper);
        sequence.verify(mapper).lockRoots();
        sequence.verify(mapper).selectAll();
        sequence.verify(mapper).insert(any());
        sequence.verify(mapper).insertScreenPermissions(9007199254740993L);
        sequence.verifyNoMoreInteractions();
    }

    @Test
    void sqlFailureDoesNotLeakSensitiveCause() throws Exception {
        when(mapper.selectAll()).thenThrow(new IllegalStateException("SQL password secret"));
        var result = mvc.perform(get("/api/admin/menus"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"))
            .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("SQL", "password", "secret");
    }

    @Test
    @SuppressWarnings("unchecked")
    void durableContractDeclaresTheExecutedOperations() throws Exception {
        Map<String, Object> document;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            document = new Yaml().load(input);
        }
        var paths = (Map<String, Map<String, Map<String, Object>>>) document.get("paths");
        assertThat(paths.get("/api/admin/menus").get("get").get("operationId")).isEqualTo("getAdminMenus");
        assertThat(paths.get("/api/admin/menus").get("put").get("operationId")).isEqualTo("updateAdminMenus");
        assertThat(paths.get("/api/admin/menus/groups").get("post").get("operationId"))
            .isEqualTo("createMenuGroup");
        assertThat((List<?>) paths.get("/api/admin/menus").get("get").get("security")).isEmpty();
        mvc.perform(get("/api/admin/menus")).andExpect(status().isOk());
    }
}
