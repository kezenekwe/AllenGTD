import React from 'react';
import {View, Text, StyleSheet, SafeAreaView} from 'react-native';

export default function WaitingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.title}>Waiting For</Text>
        <Text style={styles.sub}>Coming in Task 2.3</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 18, fontWeight: '600', color: '#000'},
  sub: {fontSize: 13, color: '#999', marginTop: 6},
});
