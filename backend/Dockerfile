FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17.0.13_11-jre-jammy AS runtime
RUN groupadd --system cost && useradd --system --gid cost --home-dir /app cost     && mkdir /app && chown cost:cost /app
WORKDIR /app
COPY --from=build --chown=cost:cost /app/target/cost-0.1.0.jar app.jar
USER cost
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5     CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080; printf "GET /api/health HTTP/1.0\r\n\r\n" >&3; IFS= read -r line <&3; [[ "$line" == *"200"* ]]'
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
