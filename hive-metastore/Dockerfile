FROM apache/hive:4.0.0

USER root

# Curl installation
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Download Hadoop AWS and AWS SDK libraries (S3A support)
RUN curl -L -o /opt/hive/lib/hadoop-aws-3.3.6.jar https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-aws/3.3.6/hadoop-aws-3.3.6.jar \
 && curl -L -o /opt/hive/lib/aws-java-sdk-bundle-1.12.262.jar https://repo1.maven.org/maven2/com/amazonaws/aws-java-sdk-bundle/1.12.262/aws-java-sdk-bundle-1.12.262.jar

USER hive