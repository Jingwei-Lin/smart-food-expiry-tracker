import { StyleSheet, Text, View } from 'react-native';

export default function RecipesScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Recipes</Text>

      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f6f8f3',
  },
  title: {
    color: '#172019',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#687269',
    fontSize: 15,
  },
});